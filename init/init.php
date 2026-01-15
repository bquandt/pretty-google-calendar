<?php

/**
 * Register shortcode(s)
 *
 * @return void
 */
function pgcal_register_shortcodes() {
  add_shortcode('pretty_google_calendar', 'pgcal_shortcode');
}


/**
 * Register front-end styles
 */
function pgcal_register_frontend_css() {
  // 3rd Party
  // wp_register_style('fullcalendar', 'https://cdn.jsdelivr.net/npm/fullcalendar@5/main.min.css', null, PGCAL_VER);
  // wp_register_style('fullcalendar', PGCAL_URL . 'public/lib/fullcalendar/main.min.css', null, PGCAL_VER);
  // wp_register_style('tippy_light', 'https://unpkg.com/tippy.js@6/themes/light.css', null, PGCAL_VER);
  wp_register_style('tippy_light', PGCAL_URL . 'public/lib/tippy/light.css', null, PGCAL_VER);

  // Local
  wp_register_style('pgcal_css', PGCAL_URL . 'public/css/pgcal.css', null, PGCAL_VER);
  wp_register_style('pgcal_tippy', PGCAL_URL . 'public/css/tippy.css', null, PGCAL_VER);
}


/**
 * Register front-end scripts
 */
function pgcal_register_frontend_js() {
  // 3rd Party
  // wp_register_script('fullcalendar', 'https://cdn.jsdelivr.net/npm/fullcalendar@5/main.js', null, PGCAL_VER, true); 
  // wp_register_script('popper', 'https://unpkg.com/@popperjs/core@2', null, PGCAL_VER, true);
  // wp_register_script('tippy', 'https://unpkg.com/tippy.js@6', null, PGCAL_VER, true);

  wp_register_script('fullcalendar', PGCAL_URL . 'public/lib/fullcalendar/index.global.min.js', null, PGCAL_VER, true);
  wp_register_script('fc_googlecalendar', PGCAL_URL . 'public/lib/fullcalendar/google-calendar/index.global.min.js', null, PGCAL_VER, true);
  wp_register_script('fc_locales', PGCAL_URL . 'public/lib/fullcalendar/locales/locales-all.global.min.js', null, PGCAL_VER, true);

  wp_register_script('popper', PGCAL_URL . 'public/lib/popper/popper.min.js', null, PGCAL_VER, true);
  wp_register_script('tippy', PGCAL_URL . 'public/lib/tippy/tippy.min.js', null, PGCAL_VER, true);

  wp_register_script('pgcal_helpers', PGCAL_URL . 'public/js/helpers.js', ['wp-i18n'], PGCAL_VER, true);
  wp_register_script('pgcal_loader', PGCAL_URL . 'public/js/pgcal.js', null, PGCAL_VER, true);
  wp_register_script('pgcal_tippy', PGCAL_URL . 'public/js/tippy.js', null, PGCAL_VER, true);

  wp_set_script_translations('pgcal_helpers', 'pgcal');
}


/**
 * Register all the things on init
 *
 * @return void
 */
function pgcal_init() {
  pgcal_register_shortcodes();
  pgcal_register_frontend_css();
  pgcal_register_frontend_js();
}
add_action('init', 'pgcal_init', 0);


/**
 * Register admin styles
 */
function pgcal_register_admin_css() {
  wp_register_style('pgcal-admin-css', PGCAL_URL . 'public/css/pgcal-admin.css');
  wp_enqueue_style('pgcal-admin-css');
}


/**
 * Register admin scripts and styles
 */
function pgcal_admin_inits() {
  pgcal_register_admin_css();
}
add_action('admin_init', 'pgcal_admin_inits');

if (is_admin())
  $pgcal_settings_page = new pgcalSettings();


/**
 * Register Ajax handler to privately pass GCAL api key
 */
function pgcal_ajax_handler() {
  $default = array();
  $globalSettings = get_option('pgcal_settings', $default);

  // Send the data as a JSON response.
  wp_send_json($globalSettings);
}

// Hook the AJAX handler to WordPress.
add_action('wp_ajax_pgcal_ajax_action', 'pgcal_ajax_handler');
add_action('wp_ajax_nopriv_pgcal_ajax_action', 'pgcal_ajax_handler');

/**
 * Register Ajax handler to log current user details
 */
function pgcal_log_user_details_handler() {
  $current_user = wp_get_current_user();
  
  $user_details = array(
    'ID' => $current_user->ID,
    'user_login' => $current_user->user_login,
    'user_email' => $current_user->user_email,
    'user_roles' => $current_user->roles,
    'display_name' => $current_user->display_name,
    'is_logged_in' => is_user_logged_in()
  );
  
  wp_send_json_success($user_details);
}

// Hook the user details AJAX handler to WordPress.
add_action('wp_ajax_pgcal_log_user_details', 'pgcal_log_user_details_handler');
add_action('wp_ajax_nopriv_pgcal_log_user_details', 'pgcal_log_user_details_handler');

/**
 * Register Ajax handler to add attendee to Google Calendar event
 *
 * How the event id/calendar id are derived (Google map mode sends a composite):
 * - Frontend sends event_id as the Google Calendar "eid" value from the URL (base64 of "<eventId> <calendarId>@g")
 * - calendar_id is often "primary" in the request; we decode the composite to extract the real calendar id
 * - The handler base64_decodes event_id, splits on space to get eventId + calendarId, and normalizes @g -> @group.calendar.google.com
 * - If attendee_email is missing, the current logged-in user email is used
 * - Then we: refresh token -> fetch event (to read existing attendees) -> patch attendees -> send updates
 *
 * POST parameters:
 * - action: pgcal_add_to_calendar
 * - event_id: The Google Calendar event ID (can be composite base64 from eid)
 * - calendar_id: The Google Calendar ID (default: primary; will be overridden if composite contains calendar id)
 * - attendee_email: The email to add as attendee (will use current user email by default)
 */
function pgcal_add_to_calendar_handler() {
  // Verify nonce for security (optional - customize as needed)
  // check_ajax_referer('pgcal_nonce');

  error_log('🔵 pgcal_add_to_calendar_handler called');
  error_log('📋 POST data: ' . json_encode($_POST));

  // Get parameters from request
  $event_id_raw = isset($_POST['event_id']) ? sanitize_text_field($_POST['event_id']) : '';
  $calendar_id = isset($_POST['calendar_id']) ? sanitize_text_field($_POST['calendar_id']) : 'primary';
  $attendee_email = isset($_POST['attendee_email']) ? sanitize_email($_POST['attendee_email']) : '';

  error_log("📝 Raw parameters: event_id_raw={$event_id_raw}, calendar_id={$calendar_id}, attendee_email={$attendee_email}");

  // Validate required parameters
  if (empty($event_id_raw)) {
    error_log('❌ Error: Event ID is required');
    wp_send_json_error(array('message' => 'Event ID is required.')); 
  }

  // Decode the event ID if it looks like a base64-encoded composite ID (from Google Calendar URL)
  // Format is base64("{event_id} {calendar_id}@group.calendar.google.com")
  $event_id = $event_id_raw;
  $decoded = base64_decode($event_id_raw, true);
  
  error_log("🔍 Raw event_id_raw: {$event_id_raw}");
  error_log("🔓 Attempting base64_decode...");
  
  if ($decoded !== false) {
    error_log("🔓 Decoded result: {$decoded}");
    
    // Check if decoded string contains a space (composite ID format)
    if (strpos($decoded, ' ') !== false) {
      error_log("✅ Found composite ID format (space-separated)");
      
      // Split by space to get event_id and calendar_id
      $parts = explode(' ', $decoded, 2);
      $event_id = trim($parts[0]);
      
      if (isset($parts[1])) {
        // Extract calendar ID from part after space
        $cal_part = trim($parts[1]);
        error_log("📋 Calendar part: {$cal_part}");
        
        // The calendar ID is everything in the string
        // It may end with @g or @group.calendar.google.com, remove those markers
        $extracted_calendar_id = $cal_part;
        
        // Clean up the calendar ID format
        if (substr($extracted_calendar_id, -2) === '@g') {
          $extracted_calendar_id = substr($extracted_calendar_id, 0, -2);
          $extracted_calendar_id .= '@group.calendar.google.com';
        } elseif (strpos($extracted_calendar_id, '@group.calendar.google.com') === false && strpos($extracted_calendar_id, '@') !== false) {
          // Has @ but not the full domain, add it
          $cal_user_id = explode('@', $extracted_calendar_id)[0];
          $extracted_calendar_id = $cal_user_id . '@group.calendar.google.com';
        }
        
        error_log("🔧 Extracted calendar ID: {$extracted_calendar_id}");
        
        // Only use extracted calendar ID if we're still using the default 'primary'
        if ($calendar_id === 'primary' && !empty($extracted_calendar_id)) {
          $calendar_id = $extracted_calendar_id;
          error_log("✅ Using extracted calendar ID: {$calendar_id}");
        }
      }
    } else {
      error_log("ℹ️ Decoded value doesn't contain space, using raw ID as-is");
      $event_id = $event_id_raw;
    }
  } else {
    error_log("ℹ️ base64_decode returned false, treating as plain event ID");
    $event_id = $event_id_raw;
  }
  
  error_log("📝 Final parsed parameters: event_id={$event_id}, calendar_id={$calendar_id}");

  // If no attendee email provided, use current user email
  if (empty($attendee_email)) {
    $current_user = wp_get_current_user();
    error_log("👤 Current user ID: {$current_user->ID}, Email: {$current_user->user_email}");
    
    if ($current_user->ID === 0) {
      error_log('❌ Error: User not logged in');
      wp_send_json_error(array('message' => 'User must be logged in or provide attendee email.'));
    }
    $attendee_email = $current_user->user_email;
    error_log("✅ Using current user email: {$attendee_email}");
  }

  // Google Calendar API credentials
  $pgcal_settings = get_option('pgcal_settings', array());
  $client_id = isset($pgcal_settings['google_client_id']) ? $pgcal_settings['google_client_id'] : '';
  $client_secret = isset($pgcal_settings['google_client_secret']) ? $pgcal_settings['google_client_secret'] : '';
  $refresh_token = isset($pgcal_settings['google_refresh_token']) ? $pgcal_settings['google_refresh_token'] : '';

  // Validate credentials exist
  if (empty($client_id) || empty($client_secret) || empty($refresh_token)) {
    error_log('❌ Error: Google Calendar credentials not configured. Please set them in plugin settings.');
    wp_send_json_error(array('message' => 'Google Calendar credentials not configured. Please set them in plugin settings.'));
    return;
  }
  
  try {
    // 1) Exchange refresh token for access token
    error_log('🔄 Exchanging refresh token for access token...');
    $token_response = wp_remote_post('https://oauth2.googleapis.com/token', array(
      'timeout' => 20,
      'headers' => array('Content-Type' => 'application/x-www-form-urlencoded'),
      'body' => array(
        'client_id' => $client_id,
        'client_secret' => $client_secret,
        'refresh_token' => $refresh_token,
        'grant_type' => 'refresh_token',
      ),
    ));

    if (is_wp_error($token_response)) {
      $error_msg = $token_response->get_error_message();
      error_log("❌ Token fetch error: {$error_msg}");
      throw new Exception('Failed to fetch access token: ' . $error_msg);
    }

    $token_code = wp_remote_retrieve_response_code($token_response);
    $token_body = wp_remote_retrieve_body($token_response);
    $token_json = json_decode($token_body, true);

    error_log("📥 Token response code: {$token_code}");
    error_log("📥 Token response body: {$token_body}");

    if ($token_code !== 200 || empty($token_json['access_token'])) {
      error_log("❌ Failed to get access token");
      throw new Exception('Failed to retrieve access token (' . $token_code . '): ' . $token_body);
    }

    error_log("✅ Access token obtained successfully");
    $access_token = $token_json['access_token'];
    $auth_headers = array(
      'Authorization' => 'Bearer ' . $access_token,
      'Content-Type' => 'application/json',
    );

    // 2) Fetch the event to get existing attendees
    error_log("🔍 Fetching event: {$event_id} from calendar: {$calendar_id}");
    $get_url = 'https://www.googleapis.com/calendar/v3/calendars/' . rawurlencode($calendar_id) . '/events/' . rawurlencode($event_id);
    error_log("📍 GET URL: {$get_url}");
    
    $get_response = wp_remote_get($get_url, array('timeout' => 20, 'headers' => $auth_headers));

    if (is_wp_error($get_response)) {
      $error_msg = $get_response->get_error_message();
      error_log("❌ Event fetch error: {$error_msg}");
      throw new Exception('Failed to fetch event: ' . $error_msg);
    }

    $get_code = wp_remote_retrieve_response_code($get_response);
    $get_body = wp_remote_retrieve_body($get_response);
    $event_json = json_decode($get_body, true);

    error_log("📥 Event response code: {$get_code}");
    error_log("📥 Event response: " . substr($get_body, 0, 500));

    if ($get_code !== 200 || empty($event_json['id'])) {
      error_log("❌ Failed to retrieve event");
      throw new Exception('Failed to retrieve event (' . $get_code . '): ' . $get_body);
    }

    error_log("✅ Event fetched successfully");
    $attendees = isset($event_json['attendees']) && is_array($event_json['attendees']) ? $event_json['attendees'] : array();
    error_log("👥 Current attendees: " . json_encode($attendees));

    // Check if user is already an attendee
    $is_already_attendee = false;
    foreach ($attendees as $att) {
      if (isset($att['email']) && strtolower($att['email']) === strtolower($attendee_email)) {
        $is_already_attendee = true;
        break;
      }
    }

    if ($is_already_attendee) {
      error_log("ℹ️ User {$attendee_email} is already an attendee");
      wp_send_json_success(array(
        'message' => 'User is already an attendee of this event.',
        'data' => array(
          'event_id' => $event_id,
          'calendar_id' => $calendar_id,
          'attendee_email' => $attendee_email,
          'already_attendee' => true
        )
      ));
      return;
    }

    // Append new attendee
    error_log("➕ Adding attendee: {$attendee_email}");
    $attendees[] = array('email' => $attendee_email);

    // 3) Patch the event with new attendees and send updates
    error_log("📝 Patching event with new attendee...");
    $patch_url = 'https://www.googleapis.com/calendar/v3/calendars/' . rawurlencode($calendar_id) . '/events/' . rawurlencode($event_id) . '?sendUpdates=all';
    $patch_body = json_encode(array('attendees' => $attendees));

    error_log("📍 PATCH URL: {$patch_url}");
    error_log("📋 PATCH body: {$patch_body}");

    $patch_response = wp_remote_request($patch_url, array(
      'method' => 'PATCH',
      'timeout' => 20,
      'headers' => $auth_headers,
      'body' => $patch_body,
    ));

    if (is_wp_error($patch_response)) {
      $error_msg = $patch_response->get_error_message();
      error_log("❌ Patch error: {$error_msg}");
      throw new Exception('Failed to patch event: ' . $error_msg);
    }

    $patch_code = wp_remote_retrieve_response_code($patch_response);
    $patch_body_resp = wp_remote_retrieve_body($patch_response);
    $updated_event = json_decode($patch_body_resp, true);

    error_log("📥 Patch response code: {$patch_code}");
    error_log("📥 Patch response: " . substr($patch_body_resp, 0, 500));

    if ($patch_code < 200 || $patch_code >= 300) {
      error_log("❌ Patch failed with code {$patch_code}");
      throw new Exception('Patch failed (' . $patch_code . '): ' . $patch_body_resp);
    }

    error_log("🎉 Event patched successfully!");
    // Success response
    wp_send_json_success(array(
      'message' => 'Successfully added to calendar event!',
      'data' => array(
        'event_id' => $event_id,
        'calendar_id' => $calendar_id,
        'attendee_email' => $attendee_email,
        'event_summary' => isset($updated_event['summary']) ? $updated_event['summary'] : '',
        'event_start' => isset($updated_event['start']['dateTime']) ? $updated_event['start']['dateTime'] : (isset($updated_event['start']['date']) ? $updated_event['start']['date'] : '')
      )
    ));

  } catch (Exception $e) {
    // General error
    $error_msg = $e->getMessage();
    error_log('❌ Error in pgcal_add_to_calendar_handler: ' . $error_msg);
    
    wp_send_json_error(array(
      'message' => 'Error: ' . $error_msg
    ));
  }
}

// Hook the add to calendar AJAX handler to WordPress.
add_action('wp_ajax_pgcal_add_to_calendar', 'pgcal_add_to_calendar_handler');
add_action('wp_ajax_nopriv_pgcal_add_to_calendar', 'pgcal_add_to_calendar_handler');
