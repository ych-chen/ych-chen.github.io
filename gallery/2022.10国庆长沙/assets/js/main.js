// Minified Debounce taken from UnderscoreJS (MIT)
function debounce(a,b,c){var d;return function(){var e=this,f=arguments;clearTimeout(d),d=setTimeout(function(){d=null,c||a.apply(e,f)},b),c&&!d&&a.apply(e,f)}}

var WebGalleryTrack = WebGalleryTrack || {};

function init(){

    // Let's cache some stuff!
    var _$w = $(window),
        _$body = $("body"),
        _$thumbnailContainer = $("#thumbnailContainer"),
        _$thumbnailsParent = $("#thumbnailContainer div.thumbnails"),
        _$thumbnails = [],
        _$loupeContainer = $("#loupeContainer"),
        _$loupeBackground = $("#loupeContainer div.background"),
        _$loupeImageContainer = $("#loupeContainer div.image-container"),
        _$loupeInfoContainer = $("#loupeContainer div.info-container"),
        _$loupeMeta = $("#loupeMeta"),
        _$buttonPrev = $("#buttonPrev"),
        _$hotspotPrevLoupe = $("#hotspotPrevLoupe"),
        _$buttonPrevSideLoupe = $("#buttonPrevSideLoupe"),
        _$buttonNext = $("#buttonNext"),
        _$hotspotNextLoupe = $("#hotspotNextLoupe"),
        _$buttonNextSideLoupe = $("#buttonNextSideLoupe"),
        _$countCurrent = $("#countCurrent"),
        _$countTotal = $("#countTotal"),
        _$buttonClose = $("#loupeCloseButton");

    var i,
        _isOpen = false,
        _$targetThumb,
        _$loupeImage,
        _loupeIsTransitioning = false,
        _currentImageIndex,
        _autoViewThumb,
        _paginationStyle = "scroll",
        _viewportHeight = 0,
        _thumbsToLoad = 0,
        _lastLoadedThumbIndex = -1,
        _currentRowContents = [];


    var onWindowResize = debounce(
        function(e) {
            _viewportHeight = _$w.height();
            sizeAllThumbnails();
            _$w.trigger("scroll");
        },
        250
    );

    // Set the current height
    _viewportHeight = _$w.height();
    _$w.on(
        "resize",
        onWindowResize
    );

    // create a global scroll handler so that we can make the header more compact as the user scrolls down the page
    _$w.on(
        "scroll",
        onWindowScroll
    );

    // Check the pagination style    
    if(_$body.attr("data-pagination-style")){
        _paginationStyle = _$body.attr("data-pagination-style");
    }

    // Loop through the global JSON object
    for(i = 0; i < LR.images.length; i++) {
        // Set some new properties
        LR.images[i].index = i;
        LR.images[i].thumbIsLoading = false;
        LR.images[i].thumbHasLoaded = false;
        LR.images[i].aspectRatio = LR.images[i].largeWidth / LR.images[i].largeHeight;
        LR.images[i].currentThumbWidth = 0;
        LR.images[i].currentThumbHeight = 0;
        // Re-set the title if needed
        if(LR.images[i].title == "nil"){
            LR.images[i].title = "";
        }
        // Re-set the caption if needed
        if(LR.images[i].caption == "nil"){
            LR.images[i].caption = "";
        }
        // Create the individual thumbnail partial
        LR.images[i].$thumbnail = $('<div class="thumbnail not-loaded" data-large-img="images/large/'+ LR.images[i].exportFilename +'.jpg" data-id="ID'+ LR.images[i].id +'" data-title="' + LR.images[i].title + '" data-caption="' + LR.images[i].caption + '" data-native-width="' + LR.images[i].largeWidth + '" data-native-height="' + LR.images[i].largeHeight + '"><img class="thumb-img" src="" /></div>');
        LR.images[i].$thumbnail.data("index", i);
        // Isolate the actual thumbnail image
        LR.images[i].$thumbnailImg = $(LR.images[i].$thumbnail.find("img")[0]);
        LR.images[i].$thumbnailImg.data("index", i);
        _$thumbnails.push(LR.images[i].$thumbnail);
    }

    // Check for an existing hash
    if(window.location.hash != ""){
        var _parts = window.location.hash.split("/");
        switch(_parts[1]){
            case "view" :
                for(var i = 0; i < LR.images.length; i++){
                    if(LR.images[i].$thumbnail.attr("data-id") == _parts[2]){
                        _autoViewThumb = LR.images[i].$thumbnail;
                        break;
                    }
                }
                break;
        }
    }

    // Render the page based on the user-selected pagination style
    switch(_paginationStyle){
        
        case "none":
            renderAllThumbnails();
            break;

        case "scroll":
            initLoadOnScroll();
            break; 
    }

    function getTargetRowHeight() {
        return _$body.attr("data-target-row-height");
    }

    function renderAllThumbnails() {
        for(var i = 0; i < LR.images.length; i++){
            _$thumbnailsParent.append(LR.images[i].$thumbnail);
            LR.images[i].$thumbnail.on(
                "click",
                onThumbnailClick
            );
            LR.images[i].$thumbnailImg.attr(
                "src",
                "images/thumbnails/" + LR.images[i].exportFilename + ".jpg"
            );
            _lastLoadedThumbIndex = LR.images[i].index;
        }
        sizeAllThumbnails();
    }

    function sizeAllThumbnails() {
        var _availableWidth = _$body.innerWidth();
        _$thumbnailContainer.css("width", _availableWidth + "px");
        _currentRowContents = [];
        var _currentRowWidth = 0;
        var _currentRowOffsetTop = 0;
        var _thumbWidth, _thumbHeight;
        for(var i = 0; i < LR.images.length; i++){
            _currentRowContents.push(LR.images[i]);
            _thumbHeight = getTargetRowHeight();
            _thumbWidth = Math.round(_thumbHeight * LR.images[i].aspectRatio);
            LR.images[i].$thumbnail.css({"width" : _thumbWidth + "px", "height" : _thumbHeight + "px"});
            LR.images[i].currentThumbWidth = _thumbWidth;
            LR.images[i].currentThumbHeight = _thumbHeight;
            _currentRowWidth += _thumbWidth;
            // if we're past our max width
            if(_currentRowWidth > _availableWidth){
                _currentRowOffsetTop += resizeRow(_currentRowContents, _availableWidth, _currentRowWidth);
                for(var j = 0; j < _currentRowContents.length; j++){
                    _currentRowContents[j].$thumbnail.data("currentRowOffsetTop", _currentRowOffsetTop);
                }
                _currentRowContents = [];
                _currentRowWidth = 0;
            }
            else {
                LR.images[i].$thumbnail.data("currentRowOffsetTop", _currentRowOffsetTop);
            }
        }
    }

    function resizeRow(rowArray, availableWidth, currentWidth){
        var _reductionRatio = availableWidth / currentWidth;
        var _newCurrentWidth = 0;
        for(var i = 0; i < rowArray.length; i++){
            var _thumbHeight = Math.floor(rowArray[i].currentThumbHeight * _reductionRatio);
            var _thumbWidth = Math.floor(rowArray[i].currentThumbWidth * _reductionRatio);
            _newCurrentWidth += _thumbWidth;
            if(i == rowArray.length - 1 && _newCurrentWidth < availableWidth){
                _thumbWidth += (availableWidth - _newCurrentWidth);
            }
            rowArray[i].$thumbnail.css({"width" : _thumbWidth + "px", "height" : _thumbHeight + "px"});
            rowArray[i].currentThumbWidth = _thumbWidth;
            rowArray[i].currentThumbHeight = _thumbHeight;
        }
        return _thumbHeight + parseInt(rowArray[0].$thumbnail.css("margin-bottom"), 10);
    }

    // Pagination Style: "scroll"

    function initLoadOnScroll() {

        if(LR.images.length == 0){
            return;
        }

        var _bodyHeight = _$body.height();


        // First, we need to create a container for every image in the gallery
        for(var i = 0; i < LR.images.length; i++){
            _$thumbnailsParent.append(LR.images[i].$thumbnail);
            LR.images[i].$thumbnail.on(
                "click",
                onThumbnailClick
            );
        }

        // Size them all based on the current viewport dimensions
        sizeAllThumbnails();

        // Loop through them, and intiate loading on anything that's visible within the current viewport

        for(var i = 0; i < LR.images.length; i++){
            if(LR.images[i].$thumbnail.data("currentRowOffsetTop") < _$w.height() + 100){
                LR.images[i].$thumbnailImg.on(
                    "load",
                    onThumbnailImgLoad
                );
                LR.images[i].$thumbnailImg.on(
                    "error",
                    onThumbnailImgError
                );
               LR.images[i].$thumbnailImg.attr(
                "src",
                "images/thumbnails/" + LR.images[i].exportFilename + ".jpg"
                );
                _lastLoadedThumbIndex = LR.images[i].index; 
            }
        }

        _$w.on(
            "scroll",
            onWindowLoadScroll
        );
    }

    function onWindowLoadScroll(e) {
        checkForSpace();
    }

    function onWindowScroll(e) {
        if(_$w.scrollTop() > 0 && !_$body.hasClass("scrolled")){
            _$body.addClass("scrolled");
        }
        else if(_$w.scrollTop() == 0 && _$body.hasClass("scrolled")) {
            _$body.removeClass("scrolled");
        }
    }

    function checkForSpace(){
        if((_$w.scrollTop() + _viewportHeight) == _$body.height() && _thumbsToLoad == 0 && _lastLoadedThumbIndex < LR.images.length - 1){
            loadMoreThumbnails(_lastLoadedThumbIndex + 1, 1);
        }
        else if(_$body.height() < _viewportHeight && _thumbsToLoad == 0){
            loadMoreThumbnails(_lastLoadedThumbIndex + 1, 1);
        }
    }

    function loadMoreThumbnails(startIndex, numRows) {
        var _currentRowOffsetTop = LR.images[_lastLoadedThumbIndex].$thumbnail.data("currentRowOffsetTop");
        var _rowsAdded = 0;
        var _newRowOffsetTop = _currentRowOffsetTop;
        for(var i = startIndex; i < LR.images.length; i++){
            if(LR.images[i] == undefined){
                break;
            }

            // Fill up the last row - there could be space in it after a viewport resize
            if(LR.images[i].$thumbnail.data("currentRowOffsetTop") == _currentRowOffsetTop){
                LR.images[i].$thumbnailImg.on(
                    "load",
                    onThumbnailImgLoad
                );
                LR.images[i].$thumbnailImg.on(
                    "error",
                    onThumbnailImgError
                );
                LR.images[i].$thumbnailImg.attr(
                    "src",
                    "images/thumbnails/" + LR.images[i].exportFilename + ".jpg"
                );
                _lastLoadedThumbIndex = LR.images[i].index;
            }
            else if(LR.images[i].$thumbnail.data("currentRowOffsetTop") > _currentRowOffsetTop){
                _rowsAdded ++;

                if(_rowsAdded > numRows){
                    break;
                }

                _currentRowOffsetTop = LR.images[i].$thumbnail.data("currentRowOffsetTop");
                LR.images[i].$thumbnailImg.on(
                    "load",
                    onThumbnailImgLoad
                );
                LR.images[i].$thumbnailImg.on(
                    "error",
                    onThumbnailImgError
                );
                LR.images[i].$thumbnailImg.attr(
                    "src",
                    "images/thumbnails/" + LR.images[i].exportFilename + ".jpg"
                );
                _lastLoadedThumbIndex = LR.images[i].index;
            }

            
        }
    }

    function onThumbnailImgLoad(e) {
        var $el = $(e.currentTarget);
        $el.parent().css(
            {
                "background-image"      : "url('" + $el.attr("src") + "')",
                "background-size"       : "cover",
                "background-position"   : "center center"
            }
        );
        $el.css("display", "none");
        $el.parent().removeClass("not-loaded");
        if(_thumbsToLoad > 0){
            _thumbsToLoad--;
        }
        else {
            checkForSpace();
        }
    }

    function onThumbnailImgError(e) {
        // we should inject an SVG or something here so that the thumbnail grid doesn't become oddly sized
        if(_thumbsToLoad > 0){
            _thumbsToLoad--;
        }
        else {
            checkForSpace();
        }
    }

    function onThumbnailClick(e) {
        showLoupeViewForThumbnail($(e.currentTarget));
    }

    // Loupe View Logic

    _$loupeContainer.fadeOut(0);
    _$loupeImageContainer.fadeOut(0);
    _$loupeInfoContainer.fadeOut(0);
    _$buttonClose.fadeOut(0);
    _$loupeBackground.css("opacity", 0);
    _$buttonClose.on(
        "click",
        closeLoupeView
    );

    _$buttonPrev.on(
        "click",
        showPrevImage
    );

    _$buttonNext.on(
        "click",
        showNextImage
    );

    _$hotspotPrevLoupe.on(
        "mouseover",
        onHotspotPrevLoupeOver
    );

    _$hotspotPrevLoupe.on(
        "mouseout",
        onHotspotPrevLoupeOut
    );

    _$hotspotPrevLoupe.on(
        "click",
        showPrevImage
    );

    _$hotspotNextLoupe.on(
        "mouseover",
        onHotspotNextLoupeOver
    );

    _$hotspotNextLoupe.on(
        "mouseout",
        onHotspotNextLoupeOut
    );

    _$hotspotNextLoupe.on(
        "click",
        showNextImage
    );
    
    if(_autoViewThumb){
        showLoupeViewForThumbnail(_autoViewThumb, true);
    }

    function openLoupeView(snap) {
        _loupeIsTransitioning = true;
        setCounts();
        _$loupeContainer.fadeIn(0);
        _$loupeBackground.css(
            {
                "width": _$targetThumb.width() + "px",
                "height": _$targetThumb.height() + "px",
                "top": (_$targetThumb.offset().top - $(window).scrollTop()) + "px",
                "left": _$targetThumb.offset().left + "px"
            }
        );
        _$loupeContainer.css("display", "block");
        var _targetTime = 250;
        if(snap){
            _targetTime = 0;
        }
        _$loupeBackground.animate(
            {
                "width": "100%",
                "height": "100%",
                "top": "0px",
                "left": "0px",
                "opacity": 1
            },
            _targetTime,
            onLoupeBackgroundShown
        );
        $(document).on(
            "keydown",
            onLoupeKeyDown
        );
    }

    function onLoupeBackgroundShown() {
        _$body.addClass("loupe-active");
        showLoupeElements();
    }

    function showLoupeElements() {
        _$loupeInfoContainer.fadeIn(350);
        _$buttonClose.fadeIn(350);
        _isOpen = true;
        showLoupeViewForThumbnail(_$targetThumb);
    }

    function showLoupeViewForThumbnail($thumbnail, snap) {
        _loupeIsTransitioning = true;
        _$targetThumb = $thumbnail;
        _currentImageIndex = _$targetThumb.data("index");
        if(!_isOpen){
            openLoupeView(snap);
            return;
        }
        setLateralNavVisibilities();
        loadImageForThumbnail(_$targetThumb);
    }

    function setLateralNavVisibilities() {
        if(_currentImageIndex == 0){
            _$hotspotPrevLoupe.addClass("disabled");
            _$buttonPrev.addClass("disabled");
        }
        else{
            _$hotspotPrevLoupe.removeClass("disabled");
            _$buttonPrev.removeClass("disabled");
        }
        if(_currentImageIndex == LR.images.length - 1){
            _$hotspotNextLoupe.addClass("disabled");
            _$buttonNext.addClass("disabled");
        }
        else{
            _$hotspotNextLoupe.removeClass("disabled");
            _$buttonNext.removeClass("disabled");
        }
    }

    function loadImageForThumbnail($thumbnail) {
        _currentImageIndex = $thumbnail.data("index");
        $('<img/>').css("opacity", 0).attr('src', $thumbnail.attr("data-large-img")).load(
            function() {
                $(this).remove();
                setImage();
            }
        );
        var _metadata = "";
        if($thumbnail.attr("data-title") != "nil" && $thumbnail.attr("data-title") != ""){
            _metadata += '<p class="title">' + $thumbnail.attr("data-title") + '</p>';
        }
        if($thumbnail.attr("data-caption") != "nil" && $thumbnail.attr("data-caption") != ""){
            _metadata += '<p class="caption">' + $thumbnail.attr("data-caption") + '</p>';
        }
        _$loupeMeta.html(_metadata);
        if(_metadata == ""){
            _$loupeContainer.addClass("meta-empty");
        }
        else {
            _$loupeContainer.removeClass("meta-empty");
        }
        setLateralNavVisibilities();
    }

    function setImage() {
        if(_$loupeImage){
            _$loupeImage.remove();
        }
        _$loupeImage = $('<div class="image"></div>');
        _$loupeCorners = $('<div class="corners"></div>');
        _$loupeImg = $('<img src="' + _$targetThumb.attr("data-large-img") + '"/>');

        _$loupeCorners.append(_$loupeImg);
        _$loupeImage.append(_$loupeCorners);

        _$loupeImageContainer.fadeOut(0);

        _$loupeImageContainer.append(_$loupeImage);
        _$loupeImageContainer.fadeIn(350, onSetImageFadeInComplete);

        setLoupeHashForID(_$targetThumb.attr("data-id"));

        _$loupeImg.css("max-height", _$loupeContainer.height() + "px");

        $(window).on(
            "resize",
            onLoupeResize
        );
    }

    function onSetImageFadeInComplete() {
        _loupeIsTransitioning = false;
    }

    function setCounts() {
        _$countTotal.html(_$thumbnails.length);
        _$countCurrent.html(_$targetThumb.data("index") + 1);
    }

    function setLoupeHashForID(id) {
        window.location.hash = "#/view/" + id;
    }

    function hideCurrentImage() {
        _loupeIsTransitioning = true;
        _$loupeImageContainer.fadeOut(100, onCurrentImageHidden);
        $(window).off(
            "resize",
            onLoupeResize
        );
    }

    function onCurrentImageHidden() {
        loadImageForThumbnail(_$targetThumb);
    }

    function showNextImage() {
        if(_loupeIsTransitioning){
            return;
        }
        if(_currentImageIndex == _$thumbnails.length - 1){
            _$targetThumb = LR.images[0].$thumbnail;
        }
        else{
            _$targetThumb = LR.images[_currentImageIndex + 1].$thumbnail;
        }
        hideCurrentImage();
        setCounts();
    }

    function showPrevImage() {
        if(_loupeIsTransitioning){
            return;
        }
        if(_currentImageIndex == 0){
            _$targetThumb = LR.images[$_thumbnails.length - 1].$thumbnail;
        }
        else{
            _$targetThumb = LR.images[_currentImageIndex - 1].$thumbnail;
        }
        hideCurrentImage();
        setCounts();
    }

    function onHotspotPrevLoupeOver(e) {
        if(_currentImageIndex > 0){
            _$hotspotPrevLoupe.addClass("over");
        }
    }

    function onHotspotPrevLoupeOut(e) {
        _$hotspotPrevLoupe.removeClass("over");
    }

    function onHotspotNextLoupeOver(e) {
        if(_currentImageIndex < _$thumbnails.length - 1){
            _$hotspotNextLoupe.addClass("over");
        }
    }

    function onHotspotNextLoupeOut(e) {
        _$hotspotNextLoupe.removeClass("over");
    }

    function onLoupeKeyDown(e){
        switch(e.keyCode){
            case 39: 
                showNextImage();
                break;
            case 37: 
                showPrevImage();
                break;
        }
    }

    function onLoupeResize(e){
        _$loupeImg.css("max-height", _$loupeContainer.height() + "px");
    }

    function closeLoupeView(e) {
        e.preventDefault();
        e.stopPropagation();
        $(window).off(
            "resize",
            onLoupeResize
        );
        _$loupeImageContainer.fadeOut(0);
        _$loupeInfoContainer.fadeOut(0);
        _$buttonClose.fadeOut(0);
        _$loupeContainer.fadeOut(0);
        _$loupeImage.remove();
        $(document).off(
            "keydown",
            onLoupeKeyDown
        );
        unlockBody();
        var currentScrollTop = _$w.scrollTop();
        window.location.hash = "";
        _$w.scrollTop(currentScrollTop);
        _isOpen = false;
        _isOpen = false;
    }

    function unlockBody() {
        _$body.removeClass("loupe-active");
    }

    // Wire up the fullscreen stuff if we can
    if(Modernizr.fullscreen){
        $("#buttonFullscreen").on(
            "click",
            toggleFullScreen
        );
    }

    if(window.hostIsLightroom){
        $("#buttonFullscreen").css("display", "none");
    }

    // This was taken from Mozilla's MDN reference: https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/Using_full_screen_mode#Browser_compatibility
    // At author-time, this API is still very much in flux and not consistent between browsers, as shown by the conditionals below:

    function toggleFullScreen(e) {
        if (!document.fullscreenElement &&    // alternative standard method
            !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement ) {  // current working methods
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
            }
            else if (document.documentElement.msRequestFullscreen) {
                document.documentElement.msRequestFullscreen();
            }
            else if (document.documentElement.mozRequestFullScreen) {
                document.documentElement.mozRequestFullScreen();
            }
            else if (document.documentElement.webkitRequestFullscreen) {
                document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
            }
        }
        else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
            else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            }
            else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
    }

    // Put some stuff in the global scope so that Live Update can trigger it
    WebGalleryTrack.sizeAllThumbnails = sizeAllThumbnails;

}

$(document).ready(function(){
    init();
});