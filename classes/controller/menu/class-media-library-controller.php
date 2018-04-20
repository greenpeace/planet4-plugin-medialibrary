<?php

namespace P4ML\Controllers\Menu;

use P4ML\Views\View;
use P4ML\Controllers\MediaLibraryApi_Controller;

if ( ! class_exists( 'Media_Library_Controller' ) ) {

	/**
	 * Class Media_Library_Controller
	 *
	 * @package P4ML\Controllers\Menu
	 */
	class Media_Library_Controller extends Controller {

		/**
		 * Creates the plugin's loader object.
		 * Checks requirements and if its ok it hooks the hook_plugin method on the 'init' action which fires
		 * after WordPress has finished loading but before any headers are sent.
		 * Most of WP is loaded at this stage (but not all) and the user is authenticated.
		 *
		 * @param string $view_class The View class name.
		 */
		public function __construct( View $view ) {
			parent::__construct( $view );
		}

		/**
		 * Create menu/submenu entry.
		 */
		public function create_admin_menu() {

			$current_user = wp_get_current_user();

			if ( in_array( 'administrator', $current_user->roles, true ) || in_array( 'editor', $current_user->roles, true ) ) {
				add_menu_page(
					'Media Library',
					'MediaLibrary',
					'edit_pages',
					P4ML_PLUGIN_SLUG_NAME,
					[ $this, 'prepare_ml_search' ],
					P4ML_ADMIN_DIR . 'images/logo_menu_page_16x16.png'
				);
			}
		}

		/**
		 * Pass all needed data to the view object for the main page.
		 */
		public function prepare_ml_search() {
			$ml_api = new MediaLibraryApi_Controller();

			$p4ml_settings = get_option( 'p4ml_main_settings' );

			$image_id      = 'GP0STPTOM';
			$image_details = [
				'image_url'   => '',
				'image_title' => '',
			];

			if ( isset( $p4ml_settings['p4ml_api_username'] ) && $p4ml_settings['p4ml_api_username'] && isset( $p4ml_settings['p4ml_api_password'] ) && $p4ml_settings['p4ml_api_password'] ) {
				// Check if the authentication API call is cached.
				$ml_auth_token = get_transient( 'ml_auth_token' );

				if ( false !== $ml_auth_token ) {
					$image_details = $this->get_image_details( $ml_auth_token, $image_id );
				} else {
					$response = $ml_api->authenticate( $p4ml_settings['p4ml_api_username'], $p4ml_settings['p4ml_api_password'] );

					if ( is_array( $response ) && $response['body'] ) {
						// Communication with ML API is authenticated.
						$body          = json_decode( $response['body'], true );
						$ml_auth_token = $body['APIResponse']['Token'];
						// Time period in seconds to keep the ml_auth_token before refreshing. Typically 1 hour.
						if ( isset( $body['APIResponse']['TimeoutPeriodMinutes'] ) ) {
							$expiration     = ( int ) ( $body['APIResponse']['TimeoutPeriodMinutes'] ) * 60;
						} else {
							$expiration     = 60 * 60; // Default expirations in 1hr.
						}

						set_transient( 'ml_auth_token', $ml_auth_token, $expiration );

						$image_details = $this->get_image_details( $ml_auth_token, $image_id );
					} else {
						$this->error( $response );
					}
				}
			} else {
				$this->warning( __( 'Plugin Settings are not configured well!', 'planet4-medialibrary' ) );
			}

			if ( '' !== $image_details['image_url'] ) {
				$is_file_exist = $this->validate_file_exists( basename( $image_details['image_url'] ) );
			}

			if ( $image_details['image_url'] && '' === $is_file_exist ) {
				$file     = $image_details['image_url'];
				$filename = basename( $file );

				$context = stream_context_create( [
						'ssl' => [
							'verify_peer'      => false,
							'verify_peer_name' => false,
						],
					]
				);

				// Upload file into WP upload dir.
				$upload_file = wp_upload_bits( $filename, null, file_get_contents( $file , FALSE, $context ) );

				if ( ! $upload_file['error'] ) {
					$wp_filetype = wp_check_filetype( $filename, null );

					// Prepare an array of post data for the attachment.
					$attachment = [
						'post_mime_type' => $wp_filetype['type'],
						'post_title'     => preg_replace( '/\.[^.]+$/', '', $image_details['image_title'] ),
						'post_content'   => $image_details['image_caption'],
						'post_status'    => 'inherit',
						'post_excerpt'   => $image_details['image_caption'],
					];

					$attachment_id = wp_insert_attachment( $attachment, $upload_file['file'], 0, true );

					if ( ! is_wp_error( $attachment_id ) ) {
						require_once( ABSPATH . 'wp-admin/includes/image.php' );

						// Generate the metadata for the attachment, and update the database record.
						$attachment_data = wp_generate_attachment_metadata( $attachment_id, $upload_file['file'] );

						wp_update_attachment_metadata( $attachment_id,  $attachment_data );

						// Set the image Alt-Text & image Credit.
						update_post_meta( $attachment_id, '_wp_attachment_image_alt', $image_details['image_title'] );
						update_post_meta( $attachment_id, '_credit_text', $image_details['image_credit'] );
					}
				} else {
					$this->error( __( 'Error while uploading file...!', 'planet4-medialibrary' ) );
				}
			}

			$this->view->pages( [
				'data' => [
					'gpml_image_id' => $image_id,
					'wp_image_id'   => '' === $is_file_exist ? $attachment_id : $is_file_exist,
					'image_title'   => $image_details['image_title'],
					'image_url'     => $image_details['image_url'],
					'is_file_exist' => $is_file_exist,
					'domain'        => 'planet4-medialibrary',
				],
			] );
		}

		/**
		 * Returns image details, fetch from GPI media library.
		 *
		 * @param string $ml_auth_token The media library API key to be used in order to call API methods.
		 * @param string $image_id      The image id is GPI media library image identifier.
		 *
		 * @return array
		 */
		public function get_image_details( $ml_auth_token, $image_id ) {
			$ml_api        = new MediaLibraryApi_Controller();
			$image_details = [];

			/**
			 * An API query is made with the following syntax:
			 * The query criteria, prefixed with query=
			 * The list of fields we require in the response, prefixed with &fields=
			 */
			$params = [
				'query'  => '(text:' . $image_id . ') and (Mediatype:Image)',
				'fields' => 'Title,Caption,Artist,ArtistShortID,Path_TR1,Path_TR1_COMP_SMALL,Path_TR7,Path_TR4,Path_TR1_COMP,Path_TR2,Path_TR3,SystemIdentifier',
				'format' => 'json',
				'token'  => $ml_auth_token,
			];

			$response = $ml_api->get_results( $params );

			if ( is_array( $response ) && $response['body'] ) {
				$image_data = json_decode( $response['body'], true );

				if ( isset( $image_data['APIResponse']['Items'][0] ) ) {
					$image_details['image_title']   = $image_data['APIResponse']['Items'][0]['Title'];
					$image_details['image_caption'] = $image_data['APIResponse']['Items'][0]['Caption'];
					$image_details['image_credit']  = $image_data['APIResponse']['Items'][0]['Artist'];

					if ( $image_data['APIResponse']['Items'][0]['Path_TR1_COMP_SMALL']['URI'] ) {
						$image_details['image_url'] = $image_data['APIResponse']['Items'][0]['Path_TR1_COMP_SMALL']['URI'];
					} elseif ( $image_data['APIResponse']['Items'][0]['Path_TR1']['URI'] ) {
						$image_details['image_url'] = $image_data['APIResponse']['Items'][0]['Path_TR1']['URI'];
					} elseif ( $image_data['APIResponse']['Items'][0]['Path_TR7']['URI'] ) {
						$image_details['image_url'] = $image_data['APIResponse']['Items'][0]['Path_TR7']['URI'];
					} elseif ( $image_data['APIResponse']['Items'][0]['Path_TR4']['URI'] ) {
						$image_details['image_url'] = $image_data['APIResponse']['Items'][0]['Path_TR4']['URI'];
					} elseif ( $image_data['APIResponse']['Items'][0]['Path_TR1_COMP']['URI'] ) {
						$image_details['image_url'] = $image_data['APIResponse']['Items'][0]['Path_TR1_COMP']['URI'];
					} elseif ( $image_data['APIResponse']['Items'][0]['Path_TR2']['URI'] ) {
						$image_details['image_url'] = $image_data['APIResponse']['Items'][0]['Path_TR2']['URI'];
					} elseif ( $image_data['APIResponse']['Items'][0]['Path_TR3']['URI'] ) {
						$image_details['image_url'] = $image_data['APIResponse']['Items'][0]['Path_TR3']['URI'];
					}

					// Filter file name for extra url params.
					$image_details['image_url'] = str_replace( strstr( $image_details['image_url'] , '?' ), '', $image_details['image_url'] );
				}
			} else {
				$this->error( $response['APIResponse']['Code'] );
			}

			return $image_details;
		}

		/**
		 * Validate file already exist in WP media, if yes then return image id.
		 *
		 * @param string $filename The file name (without full path).
		 *
		 * @return int
		 */
		protected function validate_file_exists( $filename ) {
			global $wpdb;

			$statement = $wpdb->prepare( "SELECT `post_id` FROM `{$wpdb->postmeta}` WHERE `meta_value` LIKE %s", '%' . $filename . '%' );
			$result    = $wpdb->get_col( $statement );

			return $result[0] ?? '';
		}
	}
}