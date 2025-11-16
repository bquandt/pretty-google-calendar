<?php

function pgcal_shortcode($atts) {

  $default = array();
  $globalSettings = get_option('pgcal_settings', $default);

  $args = shortcode_atts(
    array(
      // ---------------------------------------------------------------//
      //  General Calendar parameters
      // ---------------------------------------------------------------//
      'gcal'                       => "",  // Google Calendar ID
      'locale'                     => "en", // Language locale code
      'list_type'                  => "listCustom", // listDay, listWeek, listMonth, and listYear also day, week, month, and year
      'custom_list_button'         => "list",
      'custom_days'                => "29",   
      'views'                      => "dayGridMonth, listCustom",
      'initial_view'               => "dayGridMonth",
      'enforce_listview_on_mobile' => "true",
      'show_today_button'          => "true",
      'show_title'                 => "true",
      'id_hash'                    => bin2hex(random_bytes(5)),
      'use_tooltip'                => "true", // Always enable for map functionality
      'no_link'                    => isset($globalSettings['no_link']) ? "true" : "false",
      'fc_args'                    => '{}',
       // ---------------------------------------------------------------//
      //  Color Customization parameters
      // ---------------------------------------------------------------//
      'primary_color'              => "blue", // Primary colors: blue, red, green, purple, orange, teal, pink or hex value (#4285f4)
      'accent_color'               => "", // Accent color for highlights (optional, defaults to lighter version of primary)
       // ---------------------------------------------------------------//
      //  Geo-Calendar Map parameters
      // ---------------------------------------------------------------//
      'show_map'                   => "false", //set to false to show calendar only by default
      'map_height'                 => "400px",
      'map_center'                 => "40.7128,-74.0060", // lat,lng or address - Default: New York City
      'use_user_location'          => "true", // Use user's current location as map center, this works fine now, just needs user permission
      'map_zoom'                   => "1", // Default zoom level (1-20)
      'show_radius'                => "true", // Show radius circle around events
      'radius_miles'               => "25", // Radius in miles 
      'popups_open'                => "false", // Show popups by default
      'show_zoom_control'          => "true", // Show zoom in/out buttons on map
      'show_add_to_calendar'       => "true", // Show "Add to Calendar" buttons in event popups
      'show_map_legend'            => "true", // Show legend below the map explaining icons

    ),
    $atts
  );

  // Add the attributes from the shortcode OVERRIDING the stored settings
  $pgcalSettings = $args;
  $pgcalSettings["id_hash"] = preg_replace('/[\W]/', '', $pgcalSettings["id_hash"]);

  // Process color settings
  $primary_color = pgcal_process_color($pgcalSettings['primary_color']);
  $accent_color = $pgcalSettings['accent_color'] ? pgcal_process_color($pgcalSettings['accent_color']) : pgcal_lighten_color($primary_color, 20);

  wp_enqueue_script('fullcalendar');
  wp_enqueue_script('fc_googlecalendar');

  if ($pgcalSettings['locale'] !== "en") {
    wp_enqueue_script('fc_locales');
  }

  if ($pgcalSettings['use_tooltip'] === "true") {
    wp_enqueue_script('popper');
    wp_enqueue_script('tippy');
    wp_enqueue_script('pgcal_tippy');

    wp_enqueue_style('pgcal_tippy');
    wp_enqueue_style('tippy_light');
  }

  // Load Local Scripts
  wp_enqueue_script('pgcal_helpers');
  wp_enqueue_script('pgcal_loader');

  // Load Styles
  wp_enqueue_style('fullcalendar');
  wp_enqueue_style('pgcal_css');

  $script = "
    document.addEventListener('DOMContentLoaded', function() {
      function pgcal_inlineScript(settings) {        
        var ajaxurl = '" . admin_url('admin-ajax.php') . "';
        pgcal_render_calendar(settings, ajaxurl);
      }

      pgcal_inlineScript(" . json_encode($pgcalSettings) . ");
    });
  ";
  wp_add_inline_script('pgcal_loader', $script);

  // Exclusive mode: show_map="true" = map only, show_map="false" = calendar only
  $calendar_container = "";
  $map_container = "";
  
  if ($pgcalSettings['show_map'] === "true") {
    // Map-only mode
    $map_container = "<div class='pgcal-map-title'>Geo-Calendar</div><div id='pgcalmap-" . $pgcalSettings["id_hash"] . "' class='pgcal-map-container' style='height: " . esc_attr($pgcalSettings['map_height']) . ";'>" . esc_html__("loading map...", "pretty-google-calendar") . "</div>";
  } else {
    // Calendar-only mode
    $calendar_container = "<div id='pgcalendar-" . $pgcalSettings["id_hash"] . "' class='pgcal-container'>" . esc_html__("loading...", "pretty-google-calendar") . "</div>";
  }

  // Generate custom color CSS
  $color_css = "
  <style>
  #pgcalendar-" . $pgcalSettings["id_hash"] . ", #pgcalmap-" . $pgcalSettings["id_hash"] . " {
    --pgcal-primary-color: " . esc_attr($primary_color) . ";
    --pgcal-accent-color: " . esc_attr($accent_color) . ";
    --pgcal-primary-hover: " . esc_attr(pgcal_darken_color($primary_color, 15)) . ";
  }
  </style>";

  $shortcode_output = $color_css . "
  " . $calendar_container . "
  " . $map_container . "
  <div class='pgcal-branding'>" . esc_html__("Powered by", "pretty-google-calendar") . " <a href='https://wordpress.org/plugins/pretty-google-calendar/'>Pretty Google Calendar</a></div>
  ";

  return $shortcode_output;
}

/**
 * Process color input (word or hex) and return hex value
 */
function pgcal_process_color($color) {
  $color = trim(strtolower($color));
  
  // Predefined color names to hex values
  $color_map = array(
    'blue'   => '#4285f4',
    'red'    => '#ea4335', 
    'green'  => '#34a853',
    'purple' => '#9c27b0',
    'orange' => '#ff9800',
    'teal'   => '#009688',
    'pink'   => '#e91e63',
    'yellow' => '#ffeb3b',
    'cyan'   => '#00bcd4',
    'indigo' => '#3f51b5',
    'lime'   => '#8bc34a',
    'amber'  => '#ffc107'
  );
  
  // Return hex if it's a predefined color
  if (isset($color_map[$color])) {
    return $color_map[$color];
  }
  
  // If it's already a hex color, validate and return
  if (preg_match('/^#[a-f0-9]{6}$/i', $color)) {
    return $color;
  }
  
  // If it's a 3-digit hex, expand it
  if (preg_match('/^#[a-f0-9]{3}$/i', $color)) {
    return '#' . $color[1] . $color[1] . $color[2] . $color[2] . $color[3] . $color[3];
  }
  
  // Default to blue if invalid
  return '#4285f4';
}

/**
 * Lighten a hex color by a percentage
 */
function pgcal_lighten_color($hex, $percent) {
  $hex = str_replace('#', '', $hex);
  $r = hexdec(substr($hex, 0, 2));
  $g = hexdec(substr($hex, 2, 2)); 
  $b = hexdec(substr($hex, 4, 2));
  
  $r = min(255, $r + ($percent / 100) * (255 - $r));
  $g = min(255, $g + ($percent / 100) * (255 - $g));
  $b = min(255, $b + ($percent / 100) * (255 - $b));
  
  return sprintf("#%02x%02x%02x", $r, $g, $b);
}

/**
 * Darken a hex color by a percentage  
 */
function pgcal_darken_color($hex, $percent) {
  $hex = str_replace('#', '', $hex);
  $r = hexdec(substr($hex, 0, 2));
  $g = hexdec(substr($hex, 2, 2));
  $b = hexdec(substr($hex, 4, 2));
  
  $r = max(0, $r - ($percent / 100) * $r);
  $g = max(0, $g - ($percent / 100) * $g); 
  $b = max(0, $b - ($percent / 100) * $b);
  
  return sprintf("#%02x%02x%02x", $r, $g, $b);
}
