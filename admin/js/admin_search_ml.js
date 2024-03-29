var $ = jQuery;

jQuery(document).ready(function () {
    $(document).on('click', '.switchtoml', function (e) {
		// Click the GPI Media Library tab only if we clicked the Upload from GPI Media Library button from a normal page (not a modal).
        if ( 0 === $(this).closest('.media-modal').length ) {
            $('.media-frame-menu .media-menu-item:last-of-type').click();
        }
		$( '.media-button-select' ).prop('disabled', true);
        $( '.uploader-inline' ).hide();
        $( '.media-frame-content', $('.supports-drag-drop:last-of-type') ).append('<span id="ml_spinner" class="spinner ml_spinner is-active"></span>');
        var reset_page = 1;

        $.ajax({
            url: media_library_params.ajaxurl,
            type: 'GET',
            data: {
                action:          'get_search_medias',
                'paged':         reset_page,
                'query-string':  '',
                'search_flag':   false
            },
            dataType: 'html'
        }).done(function ( response ) {
            $( '.ml_spinner' ).remove();
            // Show the search query response.
            $( '.media-frame-content:last' ).append( response );
            $( '.media-frame-content' ).attr( 'data-columns', '7' );
            $( '.ml-media-sidebar' ).hide();

            // Inject ml-media-panel in the attachments browser
            $( '.ml-media-panel' ).appendTo( $( '.attachments-browser:first-of-type' ) );

        }).fail(function ( jqXHR, textStatus, errorThrown ) {
            console.log(errorThrown); //eslint-disable-line no-console
			$( '.ml_spinner' ).remove();
        });
    });

    // Hide the 'Insert to post' button.
    $(document).on('click', '.media-frame-menu .media-menu-item:last-of-type', function() {
        if ( 0 === $('#tmpl-gallery-settings').length ) {
            $('.media-button-insert').css('visibility', 'hidden');
        }
    });
});

// Get file name from full url/path.
String.prototype.filename = function( extension ) {
    var filename = this.replace(/\\/g, '/');
    filename     = filename.substring( filename.lastIndexOf('/') + 1 );
    return extension ? filename.replace(/[?#].+$/, '') : filename.split('.')[0];
}

// Add click event for image selection
function select_image( elObj ) {
    $( '.ml-media-sidebar' ).show();

    $( '.ml-image' ).attr('src', $(elObj).find('img').attr('src'));
    $( '.ml-filename' ).html( $(elObj).find('img').attr('src').filename());

    // TO DO : Need to make it dynamic.
    //$( '.ml-file-date' ).html( $(elObj).find('#ml-file-date').val());
    //$( '.ml-file-size' ).html( $(elObj).find('#ml-file-size').val());
    //$( '.ml-file-dimensions' ).html( $(elObj).find('#ml-file-dimensions').val());

    $( '.ml-url' ).val( $(elObj).find('img').attr('src'));
    $( '.ml-title' ).val( $(elObj).find('#ml-title').val());
    $( '.ml-caption' ).val( $(elObj).find('#ml-caption').val());
    $( '.ml-alt' ).val( $(elObj).find('#ml-alt').val());
    $( '.ml-description' ).val( $(elObj).find('#ml-description').val());
    $( '.ml-credit' ).val( $(elObj).find('#ml-credit').val());
    $( '.ml-media-id' ).val( $(elObj).attr('data-id'));

    // Hide/show ML additional fields.
    $( '.ml-additional-fields' ).hide();
    $( '.ml-org-lang-label' ).hide();
    $( '.ml-restrictions-label' ).hide();
    $( '.ml-radio-gr' ).hide();

    if ( $(elObj).find('#ml-ori-lang-title').val() ) {
        var ml_org_lang = '<b>' + $(elObj).find('#ml-ori-lang-title').val() + '</b><br>' + $(elObj).find('#ml-ori-lang-desc').val()
        $( '.ml-org-lang' ).html( ml_org_lang );
        $( '.ml-additional-fields' ).show();
        $( '.ml-org-lang-label' ).show();
        $( '.ml-radio-gr' ).show();
    }

    if ( $(elObj).find('#ml-restrictions').val() ) {
        $( '.ml-restrictions' ).html( $(elObj).find('#ml-restrictions').val());
        $( '.ml-additional-fields' ).show();
        $( '.ml-restrictions-label' ).show();
    }

    $( '.details' ).removeClass('details');
    $(elObj).addClass('details');
}


// Add click event for media insert button.
$(document).off('click').on('click', '#ml-button-insert', function () {

    var ml_selected_image = $( '.details' ).data('id');
    var nonce = media_library_params.nonce;
    // media_details_flag value (1 = Default Title & Description, 2 = Original language Title & Description).
    var media_details_flag = $( '.media_details_flag:checked' ).val();

    $( '#ml-button-insert' ).prop('disabled', true);
    $( '#ml_loader', $('.supports-drag-drop:last-of-type') ).addClass('is-active');

    $.ajax({
        url: media_library_params.ajaxurl,
        type: 'GET',
        data: {
            action: 'download_images_from_library',
            nonce:  nonce,
            images: [ml_selected_image],
            media_details_flag: media_details_flag
        },
        dataType: 'html'
    }).done(function (response) {

        // Switch the media library tab.
        $( '.media-router' ).find('button:nth-child(2)').click();
        // Set the media name in search field & trigger the search media event.
        $( '#media-search-input' ).val( ml_selected_image.toLowerCase() ).keyup();

		$( '#ml_loader', $('.supports-drag-drop:last-of-type') ).removeClass('is-active');

        // Remove the ml-media-panel and ml-media-sidebar div's .
        $( '.ml-media-panel' ).remove();
        $( '.ml-media-sidebar' ).remove();

    }).fail(function (jqXHR, textStatus, errorThrown) {
        console.log(errorThrown); //eslint-disable-line no-console
		$( '#ml_loader', $('.supports-drag-drop:last-of-type') ).removeClass('is-active');

        // Remove the ml-media-panel and ml-media-sidebar div's .
        $( '.ml-media-panel' ).remove();
        $( '.ml-media-sidebar' ).remove();
    });
});

var scroll_more = 0;

// Search media library images.
$(document).off('keyup').on('keyup', '.ml-search', function() {
    if (this.value.length > 3) {
        var $search = $(this);
        var reset_page = 1;
        scroll_more = 0;
        $( '#ml_current_page' ).val( reset_page );

        $( '#ml_loader', $search.closest('.media-modal') ).addClass('is-active');

        $.ajax({
            url: media_library_params.ajaxurl,
            type: 'GET',
            data: {
                action:          'get_search_medias',
                'paged':         reset_page,
                'query-string':  $( this ).val(),
                'search_flag':   true
            },
            dataType: 'html'
        }).done(function ( response ) {
            $( '#ml_loader', $search.closest('.media-modal') ).removeClass('is-active');
            // Show the search query response.
            $( '.ml-media-list' ).html( response );
        }).fail(function ( jqXHR, textStatus, errorThrown ) {
            console.log(errorThrown); //eslint-disable-line no-console
            $( '#ml_loader', $search.closest('.media-modal') ).removeClass('is-active');
        });
    }
});

// Call the function on scroll event.
function scroll_ml_images() {

    if (0 === scroll_more) {

        scroll_more = 1;
        var $ml_current_page = $( '#ml_current_page' );
        var next_page = parseInt( $ml_current_page.val() ) + 1;
        $ml_current_page.val( next_page );
        $( '#ml_loader', $('.supports-drag-drop:last-of-type') ).addClass('is-active');

        $.ajax({
            url: media_library_params.ajaxurl,
            type: 'GET',
            data: {
                action:          'get_search_medias',
                'paged':         next_page,
                'query-string':  $( '.ml-search' ).val(),
                'search_flag':   true
            },
            dataType: 'html'
        }).done(function ( response ) {
            $( '#ml_loader', $('.supports-drag-drop:last-of-type') ).removeClass('is-active');
            // Append the response at the bottom of the results.
            $( '.ml-media-list' ).append( response );

            // Set back to zero to allow loading to be triggered on scroll again.
            scroll_more = 0;
        }).fail(function ( jqXHR, textStatus, errorThrown ) {
            console.log(errorThrown); //eslint-disable-line no-console
            scroll_more = 0;
            $( '#ml_loader', $('.supports-drag-drop:last-of-type') ).removeClass('is-active');
        });
    }
}

// Toggle text fields as per radio button selection.
$(document).on('change', '.media_details_flag', function () {
    var media_details_flag = $(this).val();  // media_details_flag value (1 = Default Title & Description, 2 = Original language Title & Description).
    var media_id = $( '.ml-media-id' ).val();
    var elObj = $( 'li[data-id=' + media_id + ']' );
    if (1 === parseInt( media_details_flag )) {
        $( '.ml-title' ).val( elObj.find('#ml-title').val() );
        $( '.ml-caption' ).val( elObj.find('#ml-caption').val() );
        $( '.ml-alt' ).val( elObj.find('#ml-alt').val() );
        $( '.ml-description' ).val( elObj.find('#ml-description').val() );
    } else {
        $( '.ml-title' ).val( elObj.find('#ml-ori-lang-title').val() );
        $( '.ml-caption' ).val( elObj.find('#ml-ori-lang-desc').val() );
        $( '.ml-alt' ).val( elObj.find('#ml-ori-lang-title').val() );
        $( '.ml-description' ).val( elObj.find('#ml-ori-lang-desc').val() );
    }
});
