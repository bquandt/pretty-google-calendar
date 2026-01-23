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
 * Get current user's email for attendee checking
 */
function pgcal_get_user_email_handler() {
  $current_user = wp_get_current_user();
  
  if (is_user_logged_in() && !empty($current_user->user_email)) {
    wp_send_json(array(
      'success' => true,
      'user_email' => $current_user->user_email
    ));
  } else {
    wp_send_json(array(
      'success' => false,
      'user_email' => ''
    ));
  }
}

// Hook the get user email AJAX handler
add_action('wp_ajax_pgcal_get_user_email', 'pgcal_get_user_email_handler');
add_action('wp_ajax_nopriv_pgcal_get_user_email', 'pgcal_get_user_email_handler');

function pgcal_add_to_calendar_handler() {
  error_log('pgcal_add_to_calendar_handler called');
  error_log('POST data: ' . json_encode($_POST));

  /* ---------------------------------------------------------
   * 1. Input + basic validation
   * --------------------------------------------------------- */

  $event_id_raw   = isset($_POST['event_id']) ? sanitize_text_field($_POST['event_id']) : '';
  $calendar_id    = isset($_POST['calendar_id']) ? sanitize_text_field($_POST['calendar_id']) : 'primary';
  $isResend = isset($_POST['resend']) && $_POST['resend'] === '1';  // New flag to indicate resend attempt
  $attendee_email = isset($_POST['attendee_email']) ? sanitize_email($_POST['attendee_email']) : '';

  if (empty($event_id_raw)) {
    wp_send_json_error(['message' => 'Event ID is required.']);
  }

  /* ---------------------------------------------------------
   * 2. Decode composite/base64 event IDs
   * --------------------------------------------------------- */

  $event_id = $event_id_raw;
  $decoded  = base64_decode($event_id_raw, true);

  if ($decoded && strpos($decoded, ' ') !== false) {
    $parts = explode(' ', $decoded, 2);
    $event_id = trim($parts[0]);

    if ($calendar_id === 'primary' && !empty($parts[1])) {
      $calendar_id = trim($parts[1]);
      if (substr($calendar_id, -2) === '@g') {
        $calendar_id = substr($calendar_id, 0, -2) . '@group.calendar.google.com';
      }
    }
  }

  error_log("Parsed IDs → event_id={$event_id}, calendar_id={$calendar_id}");

  /* ---------------------------------------------------------
   * 3. Resolve attendee email
   * --------------------------------------------------------- */

  if (empty($attendee_email)) {
    $user = wp_get_current_user();
    if (!$user || !$user->ID) {
      wp_send_json_error(['message' => 'User must be logged in or provide attendee email.']);
    }
    $attendee_email = $user->user_email;
  }

  /* ---------------------------------------------------------
   * 4. Load Google credentials
   * --------------------------------------------------------- */

  $opts = get_option('pgcal_settings', []);

  $client_id     = $opts['google_client_id']     ?? '';
  $client_secret = $opts['google_client_secret'] ?? '';
  $refresh_token = get_option('pgcal_google_refresh_token'); // ✅ FIX

  if (!$client_id || !$client_secret || !$refresh_token) {
    wp_send_json_error(['message' => 'Google Calendar credentials not configured.']);
  }


  try {

    /* ---------------------------------------------------------
     * 5. Exchange refresh token for access token
     * --------------------------------------------------------- */

    $token_res = wp_remote_post('https://oauth2.googleapis.com/token', [
      'timeout' => 20,
      'headers' => ['Content-Type' => 'application/x-www-form-urlencoded'],
      'body'    => [
        'client_id'     => $client_id,
        'client_secret' => $client_secret,
        'refresh_token' => $refresh_token,
        'grant_type'    => 'refresh_token',
      ],
    ]);

    if (is_wp_error($token_res)) {
      throw new Exception($token_res->get_error_message());
    }

    $token = json_decode(wp_remote_retrieve_body($token_res), true);
    if (empty($token['access_token'])) {
      throw new Exception('Failed to obtain access token');
    }

    $headers = [
      'Authorization' => 'Bearer ' . $token['access_token'],
      'Content-Type'  => 'application/json',
    ];

        /* ---------------------------------------------------------
    * 6. events.get — fetch event directly
    * --------------------------------------------------------- */

    error_log("Fetching event via events.get");

    $get_url =
      'https://www.googleapis.com/calendar/v3/calendars/' .
      rawurlencode($calendar_id) .
      '/events/' .
      rawurlencode($event_id);

    $get_res = wp_remote_get($get_url, [
      'timeout' => 20,
      'headers' => $headers,
    ]);

    if (is_wp_error($get_res)) {
      throw new Exception('events.get failed: ' . $get_res->get_error_message());
    }

    $event_json = json_decode(wp_remote_retrieve_body($get_res), true);

    if (empty($event_json['id'])) {
      throw new Exception('Event not found via events.get');
    }

    error_log("Fetched event {$event_json['id']}");

    /* ---------------------------------------------------------
     * 7. Handle Attendee Logic (Add or Resend)
     * --------------------------------------------------------- */

    $attendees = $event_json['attendees'] ?? [];
    $is_already_attendee = false;

    // Check if user is already attending
    foreach ($attendees as $a) {
      if (isset($a['email']) && strtolower($a['email']) === strtolower($attendee_email)) {
        $is_already_attendee = true;
        break;
      }
    }

    // If resend mode and user is attendee: remove them first (silent, no notification)
    if ($isResend && $is_already_attendee) {
      error_log("Resend mode: Removing attendee for fresh invite");
      
      // Filter out the attendee
      $attendees = array_filter($attendees, function($a) use ($attendee_email) {
        return !(isset($a['email']) && strtolower($a['email']) === strtolower($attendee_email));
      });
      $attendees = array_values($attendees); // Reindex array

      // PATCH with sendUpdates=none (silent removal, no email sent)
      $patch_url_silent = 'https://www.googleapis.com/calendar/v3/calendars/' .
        rawurlencode($calendar_id) . '/events/' .
        rawurlencode($event_id) . '?sendUpdates=none';

      $patch_res_silent = wp_remote_request($patch_url_silent, [
        'method'  => 'PATCH',
        'timeout' => 20,
        'headers' => $headers,
        'body'    => json_encode(['attendees' => $attendees]),
      ]);

      if (is_wp_error($patch_res_silent)) {
        throw new Exception('Failed to remove attendee for resend: ' . $patch_res_silent->get_error_message());
      }

      error_log("Attendee removed, now re-adding with fresh invite");
    } elseif (!$isResend && $is_already_attendee) {
      // Normal add mode: user already attending, return early
      wp_send_json_success([
        'message' => 'User already attending this event.',
        'data'    => ['already_attendee' => true],
      ]);
    }

    /* ---------------------------------------------------------
     * 8. Add/Re-add Attendee with Notification (sendUpdates=all)
     * --------------------------------------------------------- */

    // Ensure attendee not already in list (handles both normal add and resend)
    $attendees = array_filter($attendees, function($a) use ($attendee_email) {
      return !(isset($a['email']) && strtolower($a['email']) === strtolower($attendee_email));
    });
    $attendees = array_values($attendees);

    // Add the attendee
    $attendees[] = ['email' => $attendee_email];

    // PATCH with sendUpdates=all (sends notification/fresh invite)
    $patch_url = 'https://www.googleapis.com/calendar/v3/calendars/' .
      rawurlencode($calendar_id) . '/events/' .
      rawurlencode($event_id) . '?sendUpdates=all';

    $patch_res = wp_remote_request($patch_url, [
      'method'  => 'PATCH',
      'timeout' => 20,
      'headers' => $headers,
      'body'    => json_encode(['attendees' => $attendees]),
    ]);

    if (is_wp_error($patch_res)) {
      throw new Exception($patch_res->get_error_message());
    }

    $updated = json_decode(wp_remote_retrieve_body($patch_res), true);

    wp_send_json_success([
      'message' => $isResend ? 'Invite resent successfully!' : 'Successfully added to calendar event!',
      'data'    => [
        'event_id'   => $event_id,
        'calendar_id'=> $calendar_id,
        'attendee'   => $attendee_email,
        'summary'    => $updated['summary'] ?? '',
        'start'      => $updated['start']['dateTime']
                          ?? $updated['start']['date']
                          ?? '',
      ],
    ]);

  } catch (Exception $e) {
    error_log('pgcal_add_to_calendar_handler error: ' . $e->getMessage());
    wp_send_json_error(['message' => $e->getMessage()]);
  }
}

//Experimaental to chek if a user is already an attendee of an event
function pgcal_is_user_attendee(
  string $event_id_raw,
  string $attendee_email,
  array $calendar_ids,
  string $access_token
): bool {

  error_log("[pgcal_is_user_attendee] start");

  /* --------------------------------------------------
   * 1. Decode composite/base64 event ID
   * -------------------------------------------------- */

  $extracted_event_id = $event_id_raw;
  $extracted_calendar_id = '';

  $decoded = base64_decode($event_id_raw, true);
  if ($decoded && strpos($decoded, ' ') !== false) {
    [$eid, $cal] = explode(' ', $decoded, 2);
    $extracted_event_id = trim($eid);

    $cal = trim($cal);
    if (substr($cal, -2) === '@g') {
      $cal = substr($cal, 0, -2) . '@group.calendar.google.com';
    }
    $extracted_calendar_id = $cal;

    error_log("[pgcal_is_user_attendee]Composite decoded → event={$extracted_event_id}, calendar={$extracted_calendar_id}");
  }

  /* --------------------------------------------------
   * 2. Build calendar list
   * -------------------------------------------------- */

  $calendars_to_try = [];

  if ($extracted_calendar_id) {
    $calendars_to_try[] = $extracted_calendar_id;
  }

  foreach ($calendar_ids as $cid) {
    if ($cid) {
      $calendars_to_try[] = $cid;
    }
  }

  $calendars_to_try = array_unique($calendars_to_try);

  if (empty($calendars_to_try)) {
    error_log("❌ No calendars to try");
    return false;
  }

  error_log("[pgcal_is_user_attendee] Calendars to try: " . implode(', ', $calendars_to_try));

  /* --------------------------------------------------
   * 3. OAuth headers
   * -------------------------------------------------- */

  $headers = [
    'Authorization' => 'Bearer ' . $access_token,
    'Accept'        => 'application/json',
  ];

  /* --------------------------------------------------
   * 4. events.list (curl-equivalent)
   * -------------------------------------------------- */

  foreach ($calendars_to_try as $calendar_id) {

    $list_url =
  'https://www.googleapis.com/calendar/v3/calendars/' .
  rawurlencode($calendar_id) .
  '/events';

error_log("[pgcal_is_user_attendee] events.list URL (minimal): {$list_url}");

$res = wp_remote_get($list_url, [
  'timeout' => 20,
  'headers' => [
    'Authorization' => 'Bearer ' . $access_token,
    'Accept'        => 'application/json',
  ],
]);


    if (is_wp_error($res)) {
      error_log("⚠️ Request failed for {$calendar_id}");
      continue;
    }

    $body = json_decode(wp_remote_retrieve_body($res), true);

    if (empty($body['items'])) {
      error_log("ℹ️ No events returned for {$calendar_id}");
      continue;
    }

    error_log("📦 " . count($body['items']) . " events fetched");

    /* --------------------------------------------------
     * 5. Match event client-side
     * -------------------------------------------------- */

    foreach ($body['items'] as $event) {

      if (
        ($event['id'] ?? '') === $extracted_event_id ||
        ($event['iCalUID'] ?? '') === $extracted_event_id ||
        ($event['id'] ?? '') === $event_id_raw ||
        ($event['iCalUID'] ?? '') === $event_id_raw
      ) {
        error_log("✅ Matched event {$event['id']}");

        /* --------------------------------------------------
         * 6. Check attendees
         * -------------------------------------------------- */

        $attendees = $event['attendees'] ?? [];

        foreach ($attendees as $att) {
          if (
            isset($att['email']) &&
            strtolower($att['email']) === strtolower($attendee_email)
          ) {
            error_log("✅ User already attendee");
            return true;
          }
        }

        error_log("❌ User not attendee");
        return false;
      }
    }
  }

  error_log("❌ Event not found in any calendar");
  return false;
}


function pgcal_is_attendee_handler() {

  error_log('[pgcal_is_attendee_handler] called');
  error_log('[pgcal_is_attendee_handler] POST data: ' . json_encode($_POST));

  $event_id_raw   = sanitize_text_field($_POST['event_id'] ?? '');
  $attendee_email = sanitize_email($_POST['attendee_email'] ?? '');
  $calendar_ids   = isset($_POST['calendar_ids'])
    ? array_map('trim', explode(',', sanitize_text_field($_POST['calendar_ids'])))
    : [];

  if (!$event_id_raw || !$attendee_email) {
    wp_send_json_error(['message' => 'Missing parameters']);
  }

  /* --------------------------------------------------
   * Load OAuth credentials
   * -------------------------------------------------- */

  $opts = get_option('pgcal_settings', []);

  $client_id     = $opts['google_client_id']     ?? '';
  $client_secret = $opts['google_client_secret'] ?? '';
  $refresh_token = get_option('pgcal_google_refresh_token'); // ✅ FIX

  if (!$client_id || !$client_secret || !$refresh_token) {
    wp_send_json_error(['message' => 'Google credentials missing']);
  }


  /* --------------------------------------------------
   * Exchange refresh token → access token
   * -------------------------------------------------- */

  $token_res = wp_remote_post('https://oauth2.googleapis.com/token', [
    'headers' => ['Content-Type' => 'application/x-www-form-urlencoded'],
    'body' => [
      'client_id'     => $client_id,
      'client_secret' => $client_secret,
      'refresh_token' => $refresh_token,
      'grant_type'    => 'refresh_token',
    ],
  ]);

  if (is_wp_error($token_res)) {
    wp_send_json_error(['message' => 'Token exchange failed']);
  }

  $token = json_decode(wp_remote_retrieve_body($token_res), true);
  if (empty($token['access_token'])) {
    wp_send_json_error(['message' => 'No access token']);
  }

  /* --------------------------------------------------
   * Delegate to core function
   * -------------------------------------------------- */

  $is_attendee = pgcal_is_user_attendee(
    $event_id_raw,
    $attendee_email,
    $calendar_ids,
    $token['access_token']
  );

  wp_send_json_success([
    'isAttendee' => $is_attendee
  ]);
}


// Hook the add to calendar AJAX handler to WordPress.
add_action('wp_ajax_pgcal_add_to_calendar', 'pgcal_add_to_calendar_handler');
add_action('wp_ajax_nopriv_pgcal_add_to_calendar', 'pgcal_add_to_calendar_handler');

add_action('wp_ajax_pgcal_is_attendee', 'pgcal_is_attendee_handler');
add_action('wp_ajax_nopriv_pgcal_is_attendee', 'pgcal_is_attendee_handler');
