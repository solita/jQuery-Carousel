/*!
 * http://ajk.im/js/jquery.carousel.js v0.4
 *
 * Copyright (c) 2011-2012 Antti-Jussi Kovalainen
 *
 * Usage: $('ul.someElement').carousel({ options here });
 *
 * Options:
 *     transition: '[scroll|fade]'
 *     slideshow: seconds (0 to disable)
 *     showArrows: true|false
 *     showNavigation: true|false (instant navigation to slides, numbers)
 *     fluid: true|false
 *     afterInit: function()
 *     onPrev: function()
 *     onNext: function()
 */

(function ($) {

    $.fn.carousel = function (options_in) {

        var options = $.extend({
            transition: 'scroll',       // [scroll|fade]
            slideshow: 0,               // time in seconds for slideshow, 0 to disable
            showArrows: true,           // show navigation arrows (prev & next)
            showNavigation: false,      // show jump navigation/instant navigation/pagination (whatever.)
            fluid: true,                // fluid layout (= monitor resizing)
            firstItem: 1,               // NOT IMPLEMENTED YET (TODO)
            afterInit: function(carousel) {},   // Callback: Called after all initialization
            onPrev: function() {},      // Callback: Called when the user clicks on 'previous' arrow
            onNext: function() {}       // Callback: Called when the user clicks on 'next' arrow
        }, options_in);

        return this.each(function () {

            var $this = $(this),
                list = null,
                wrapper = null,
                items = [],

                currentPage = 1,
                singleWidth = 0, // used only by 'scroll' -transition
                itemsPerPage = 1,
                pages = 1,

                slideshowTimer = null,
                paused = false,

                setCSS = function () {};

            // initialization
            (function init() {
                if ($this.is('div')) {
                    wrapper = $this;
                    list = $this.find('> ul');
                }
                else if ($this.is('ul')) {
                    // create a wrapper <div>
                    wrapper = $('<div class="carouselWrapper"></div>');
                    list = $this;

                    wrapper.insertBefore(list)
                           .append(list);
                }
                else {
                    throw "jQuery carousel can only be used on a <div> or <ul>";
                }

                items = list.find('> li');

                // add 'hover' class on hover (IE6-support)
                list.hover(function () {
                    list.addClass('hover');
                }, function () {
                    list.removeClass('hover');
                });

                // transition specific initialization
                if (options.transition == 'scroll') {
                    initScroll();
                    setCSS = setScrollCSS;
                }
                else if (options.transition == 'fade') {
                    initFade();
                    setCSS = setFadeCSS;
                }
                else {
                    throw "Unknown jQuery carousel transition!";
                }

                setCSS();

                // add arrow navigation
                if (options.showArrows) {
                    var prevArrow = $('<a href="#" class="nav carouselBack">&larr;</a>'),
                        nextArrow = $('<a href="#" class="nav carouselNext">&rarr;</a>');

                    if (pages <= 1) {
                        prevArrow = $('<span href="#" class="nav carouselBack disabled">&larr;</span>');
                        nextArrow = $('<span href="#" class="nav carouselNext disabled">&rarr;</span>');
                    }
                    else {
                        // click events
                        prevArrow.click(function () {
                            options.onPrev();
                            return gotoPage(currentPage - 1);
                        });

                        nextArrow.click(function () {
                            options.onNext();
                            return gotoPage(currentPage + 1);
                        });
                    }

                    wrapper.after(nextArrow).after(prevArrow);
                }

                // add jump navigation (pagination)
                if (options.showNavigation) {
                    if (pages <= 1) {
                        return;
                    }

                    var nav = $('<div class="carouselNav"></div>');

                    for (var i = 1; i <= pages; ++i) {
                        var item = $('<a href="#">' + i + '</a>');

                        if (i == 1) {
                            item.addClass('act');
                        }

                        item.click(function () {
                            var j = $(this).index();
                            return gotoPage(j + 1);
                        });
                        nav.append(item);
                    }

                    wrapper.after(nav);
                }

                if (options.fluid) {
                    $(window).resize(function (e) {
                        setCSS();
                    });

                    // wait for images to load and then re-set  CSS
                    var currentItem = $(items[currentPage - 1]),
                        images = currentItem.find('img'),
                        tmpCount = 0;

                    images.load(function () {
                        tmpCount++;

                        if (tmpCount == images.length) {
                            setCSS();
                        }

                        $(this).unbind('load');
                    });
                }

                // start slideshow
                if (isSlideshow()) {
                    setSlideshow();
                }

                // bind to an event (support external events)
                list.bind('goto', function (event, page) {
                    gotoPage(page);
                });

                list.bind('pause', function () {
                    paused = true;
                });

                list.bind('play', function () {
                    paused = false;
                });

                options.afterInit(wrapper);
            })();

            function initScroll() {
                var firstItem = $(items[0]);
                
                items.css({
                    display: 'inline-block',
                    float: 'left'
                });
                
                singleWidth = firstItem.outerWidth(true);
                
                if (singleWidth == 0) {
                    // TODO: replace this quick fix (crashes if singleWidth == 0)
                    return;
                }

                // TODO: check that all items are equal width -- it's a requirement with this type of scrolling

                itemsPerPage = Math.floor(wrapper.outerWidth(true) / singleWidth);
                pages = countPages();

                // add empty items to end of list, when there are not enough
                if ((items.length % itemsPerPage) != 0) {
                    var emptyItemCount = itemsPerPage - (items.length % itemsPerPage),
                        emptyItem = firstItem.clone().empty().addClass('empty');

                    emptyItem.height(firstItem.height());
                    emptyItem.width(firstItem.width());

                    for (var i = 0; i < emptyItemCount; i++) {
                        list.append(emptyItem.clone());
                    }
                }
                items = list.find('> li');

                // clone items to the start and end of the list to enable "infinite" scrolling
                if (pages > 1) {
                    firstItem.before(items.slice(-itemsPerPage).clone().addClass('cloned'));
                    items.filter(':last').after(items.slice(0, itemsPerPage).clone().addClass('cloned'));

                    // position to first real item
                    list.css('left', -singleWidth * itemsPerPage);
                }

                items = list.find('> li');
            }

            function initFade() {
                itemsPerPage = 1;
                pages = countPages();
            }


            function setScrollCSS() {
                var currentItem = $(items[currentPage - 1]);

                // create a wrapper <div>
                wrapper.css({
                    height: '100%',
                    overflow: 'hidden',
                    position: 'relative',
                    width: list.width()
                });

                // set css
                list.css({
                    listStyle: 'none',
                    position: 'absolute',
                    width: '31000em'
                });

                items.css({
                    display: 'block',
                    float: 'left'
                });
            }


            function setFadeCSS() {
                // reset in-line styles
                wrapper.attr('style', '');
                list.attr('style', '');
                items.attr('style', '');

                var currentItem = $(items[currentPage - 1]);

                width = currentItem.outerWidth();

                wrapper.css({
                    height: currentItem.outerHeight(),
                    overflow: 'hidden',
                    position: 'relative'
                });

                list.css({
                    listStyle: 'none',
                    position: 'absolute',
                    width: '31000em'
                });

                items.css({
                    display: 'none',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: width
                });

                currentItem.show();
            }


            function countPages() {
                return new Number(Math.ceil(items.length / itemsPerPage)); // TODO: include border and/or padding
            }

            function isSlideshow() {
                return (!isNaN(options.slideshow) && (options.slideshow > 0));
            }

            function setSlideshow() {
                clearTimeout(slideshowTimer);
                slideshowTimer = setTimeout(function () {
                    gotoPage(currentPage + 1, true);
                }, options.slideshow * 1000);
            }

            function gotoPage(page, calledBySlideshow) {
                if (currentPage == page || pages == 1) {
                    return false;
                }

                // start the slideshow-timer again
                if (isSlideshow()) {
                    if (page > pages) {
                        page = 1;
                    }
                    setSlideshow();
                }

                if (calledBySlideshow && (list.hasClass('hover') || paused)) {
                    return false;
                }

                if (options.showNavigation) {
                    var navItems = wrapper.siblings('.carouselNav').children();
                    navItems.removeClass('act');
                    $(navItems[page - 1]).addClass('act');
                }

                if (options.transition == 'scroll') {
                    scrollTo(page);
                }
                else if (options.transition == 'fade') {
                    fadeTo(page);
                }

                if (options.fluid) {
                    setCSS();
                }

                return false;
            }


            // transitions:

            function scrollTo(page) {
                if (list.is(':animated')) {
                    return;
                }

                var dir = currentPage > page ? -1 : 1;
                left = singleWidth * itemsPerPage * page,
                    singlePageWidth = singleWidth * itemsPerPage,
                    maxLeft = singleWidth * itemsPerPage * pages,
                    minLeft = singlePageWidth;

                list.animate({
                    left: -left
                }, 500, function () {
                    if (page == 0) {
                        list.css('left', -maxLeft);
                        page = pages
                    }
                    else if (page > pages) {
                        list.css('left', -singlePageWidth);
                        page = 1;
                    }

                    currentPage = page;
                });
            }

            function fadeTo(page) {
                if (page == 0) {
                    page = pages;
                }
                else if (page > pages) {
                    page = 1;
                }

                var currentItem = $(items.get(currentPage - 1)),
                    nextItem = $(items.get(page - 1));

                currentItem.stop(true, true).fadeOut();
                nextItem.stop(true, true).fadeIn();

                currentPage = page;
            }

        });

    }; /* fn.carousel */

})(jQuery);
