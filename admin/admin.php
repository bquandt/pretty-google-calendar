<?php

/** @package  */
class pgcalSettings {
  /**
   * Holds the values to be used in the fields callbacks
   */
  private $options;

  /**
   * Start up
   */
  public function __construct() {
    add_action('admin_menu', array($this, 'pgcal_add_plugin_page'));
    add_action('admin_init', array($this, 'pgcal_page_init'));
  }

  /**
   * Add options page
   */
  public function pgcal_add_plugin_page() {
    // This page will be under "Settings"
    add_options_page(
      esc_attr__('Settings Admin', 'pretty-google-calendar'),
      esc_attr__('Pretty Google Calendar Settings', 'pretty-google-calendar'),
      'manage_options',
      'pgcal-setting-admin',
      array($this, 'pgcal_create_admin_page')
    );
  }

  /**
   * Options page callback
   */
  public function pgcal_create_admin_page() {
    // Set class property
    $this->options = get_option('pgcal_settings');
?>
    <div class="pgcal-settings-header">

      <div class="pgcal-logo">
        <svg version="1.1" width="141" height="146" viewBox="0 0 141 146" xmlns="http://www.w3.org/2000/svg">
          <path d="M13.3 126.4v-89c0-2.4.9-4.5 2.6-6.3s3.8-2.6 6.2-2.6h8.8v-6.7c0-3.1 1.1-5.7 3.2-7.9 2.2-2.2 4.7-3.3 7.8-3.3h4.4c3 0 5.6 1.1 7.8 3.3s3.2 4.8 3.2 7.9v6.7h26.4v-6.7c0-3.1 1.1-5.7 3.2-7.9 2.2-2.2 4.7-3.3 7.8-3.3h4.4c3 0 5.6 1.1 7.8 3.3s3.2 4.8 3.2 7.9v6.7h8.8c2.4 0 4.4.9 6.2 2.6 1.7 1.8 2.6 3.8 2.6 6.3v88.9c0 2.4-.9 4.5-2.6 6.3s-3.8 2.6-6.2 2.6H22.1c-2.4 0-4.4-.9-6.2-2.6-1.7-1.8-2.6-3.8-2.6-6.2zm8.8 0h96.8V55.2H22.1v71.2zm17.6-84.5c0 .6.2 1.2.6 1.6s.9.6 1.6.6h4.4c.6 0 1.2-.2 1.6-.6s.6-.9.6-1.6v-20c0-.6-.2-1.2-.6-1.6s-.9-.6-1.6-.6h-4.4c-.6 0-1.2.2-1.6.6s-.6 1-.6 1.6v20zm52.8 0c0 .6.2 1.2.6 1.6s.9.6 1.6.6h4.4c.6 0 1.2-.2 1.6-.6s.6-.9.6-1.6v-20c0-.6-.2-1.2-.6-1.6s-.9-.6-1.6-.6h-4.4c-.6 0-1.2.2-1.6.6s-.6 1-.6 1.6v20z" />
          <text transform="scale(.98902 1.0111)" x="60" y="69.305733" font-family="Z003" font-size="19.485px" letter-spacing="0" stroke-width="1.218" text-anchor="middle" word-spacing="0" style="line-height:1.25" xml:space="preserve">
            <tspan x="60" y="69.305733">Pretty</tspan>
            <tspan x="60" y="95.274574">Google</tspan>
            <tspan x="65" y="121.24342">Calendar</tspan>
          </text>
        </svg>
      </div>
      <h1><?php echo esc_html__('Pretty Google Calendar Settings', 'pretty-google-calendar') ?></h1>
      <p>
        <button><a href="https://github.com/sponsors/lbell"><?php echo esc_html__('Sponsor', 'pretty-google-calendar') ?></a></button>
      </p>
    </div>
    <form method="post" action="options.php">
      <?php
      // This prints out all hidden setting fields
      settings_fields('pgcal_option_group');
      do_settings_sections('pgcal-setting-admin');
      submit_button();
      ?>
    </form>
    </div>
<?php
  }

  /**
   * Register and add settings
   */
  public function pgcal_page_init() {
    register_setting(
      'pgcal_option_group', // Option group
      'pgcal_settings', // Option name
      array($this, 'pgcal_sanitize') // Sanitize
    );

    add_settings_section(
      'pgcal-main-settings',
      esc_attr__('Usage', 'pretty-google-calendar'),
      array($this, 'pgcal_pring_main_info'), // Callback
      'pgcal-setting-admin' // Page
    );

    add_settings_field(
      'google_api',
      esc_attr__('Google API', 'pretty-google-calendar'),
      array($this, 'pgcal_gapi_callback'), // Callback
      'pgcal-setting-admin', // Page
      'pgcal-main-settings' // Section
    );

    // add_settings_field(
    //   'use_tooltip',
    //   esc_attr__('Use Tooltip (Migrating to shortcode attribute use_tooltip)', 'pretty-google-calendar'),
    //   array($this, 'pgcal_tooltip_callback'),
    //   'pgcal-setting-admin',
    //   'pgcal-main-settings'
    // );

    // add_settings_field(
    //   'no_link',
    //   esc_attr__('Disable Event Link (Migrating to shortcode attribute no_link)', 'pretty-google-calendar'),
    //   array($this, 'pgcal_no_link_callback'),
    //   'pgcal-setting-admin',
    //   'pgcal-main-settings'
    // );
  }

  /**
   * Sanitize each setting field as needed
   *
   * @param array $input Contains all settings fields as array keys
   */
  public function pgcal_sanitize($input) {
    $sanitized_input = array();
    if (isset($input['google_api']))
      // TODO test api?
      $sanitized_input['google_api'] = $input['google_api'];

    // if (isset($input['use_tooltip']))
    //   $sanitized_input['use_tooltip'] = sanitize_text_field($input['use_tooltip']);

    // if (isset($input['no_link']))
    //   $sanitized_input['no_link'] = sanitize_text_field($input['no_link']);

    return $sanitized_input;
  }

  /**
   * Print the Section text
   */
  public function pgcal_pring_main_info() {
    printf(
      '<div style="max-width: 1000px;">
      
      <h3>%s</h3>
      <p><code>[pretty_google_calendar gcal="address@group.calendar.google.com"]</code></p>
      
      <h4>Important Links:</h4>
      <ul>
        <li>%s <a href="https://fullcalendar.io/docs/google-calendar" target="_blank">https://fullcalendar.io/docs/google-calendar</a></li>
        <li>%s <a href="https://wordpress.org/plugins/pretty-google-calendar/#installation" target="_blank">Installation Guide</a></li>
      </ul>
      
      <p><strong>%s</strong></p>
      
      <div style="margin: 20px 0;">
        <h3 style="color: #2271b1; border-bottom: 2px solid #2271b1; padding-bottom: 5px;">%s</h3>
        <table class="widefat striped" style="margin-top: 10px;">
          <thead>
            <tr>
              <th style="width: 25%%;">Parameter</th>
              <th style="width: 20%%;">Default Value</th>
              <th style="width: 55%%;">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>gcal=""</code></td><td><em>required</em></td><td>%s</td></tr>
            <tr><td><code>locale="en"</code></td><td>en</td><td>%s</td></tr>
            <tr><td><code>list_type="listCustom"</code></td><td>listCustom</td><td>%s</td></tr>
            <tr><td><code>custom_list_button="list"</code></td><td>list</td><td>%s</td></tr>
            <tr><td><code>custom_days="29"</code></td><td>29</td><td>%s</td></tr>
            <tr><td><code>views="dayGridMonth, listCustom"</code></td><td>dayGridMonth, listCustom</td><td>%s</td></tr>
            <tr><td><code>initial_view="dayGridMonth"</code></td><td>dayGridMonth</td><td>%s</td></tr>
            <tr><td><code>enforce_listview_on_mobile="true"</code></td><td>true</td><td>%s</td></tr>
            <tr><td><code>show_today_button="true"</code></td><td>true</td><td>%s</td></tr>
            <tr><td><code>show_title="true"</code></td><td>true</td><td>%s</td></tr>
            <tr><td><code>use_tooltip="true"</code></td><td>true</td><td>%s</td></tr>
            <tr><td><code>no_link="false"</code></td><td>false</td><td>%s</td></tr>
            <tr><td><code>primary_color="blue"</code></td><td>blue</td><td>%s</td></tr>
            <tr><td><code>accent_color=""</code></td><td><em>empty</em></td><td>%s</td></tr>
            <tr><td><code>fc_args="{}"</code></td><td>{}</td><td>%s</td></tr>
          </tbody>
        </table>
      </div>
      
      <div style="margin: 20px 0;">
        <h3 style="color: #d63638; border-bottom: 2px solid #d63638; padding-bottom: 5px;">%s</h3>
        <table class="widefat striped" style="margin-top: 10px;">
          <thead>
            <tr>
              <th style="width: 25%%;">Parameter</th>
              <th style="width: 20%%;">Default Value</th>
              <th style="width: 55%%;">Description</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>show_map="false"</code></td><td>false</td><td>%s</td></tr>
            <tr><td><code>map_height="400px"</code></td><td>400px</td><td>%s</td></tr>
            <tr><td><code>map_center="40.7128,-74.0060"</code></td><td>40.7128,-74.0060</td><td>%s</td></tr>
            <tr><td><code>use_user_location="true"</code></td><td>true</td><td>%s</td></tr>
            <tr><td><code>map_zoom="1"</code></td><td>1</td><td>%s</td></tr>
            <tr><td><code>show_radius="true"</code></td><td>true</td><td>%s</td></tr>
            <tr><td><code>radius_miles="25"</code></td><td>25</td><td>%s</td></tr>
            <tr><td><code>popups_open="false"</code></td><td>false</td><td>%s</td></tr>
            <tr><td><code>show_zoom_control="true"</code></td><td>true</td><td>%s</td></tr>
            <tr><td><code>show_add_to_calendar="true"</code></td><td>true</td><td>%s</td></tr>
            <tr><td><code>show_map_legend="true"</code></td><td>true</td><td>%s</td></tr>
          </tbody>
        </table>
      </div>
      
      </div>',
      esc_html__("Shortcode Usage:", "pretty-google-calendar"),
      esc_html__("You must have a google calendar API. See:", "pretty-google-calendar"),
      esc_html__("For shortcode usage and options, see:", "pretty-google-calendar"),
      esc_html__("Note: Multiple calendars can be specified with comma-separated IDs.", "pretty-google-calendar"),
      esc_html__("Calendar Parameters:", "pretty-google-calendar"),
      esc_html__("Google Calendar ID(s) - comma-separated for multiple calendars", "pretty-google-calendar"),
      esc_html__("Language/locale for calendar display (default: en)", "pretty-google-calendar"),
      esc_html__("List view type: listCustom, listDay, listWeek, listMonth, listYear", "pretty-google-calendar"),
      esc_html__("Custom list button text (default: list)", "pretty-google-calendar"),
      esc_html__("Number of days to show in custom list view (default: 29)", "pretty-google-calendar"),
      esc_html__("Available calendar views, comma-separated", "pretty-google-calendar"),
      esc_html__("Default view when calendar loads", "pretty-google-calendar"),
      esc_html__("Force list view on mobile devices (default: true)", "pretty-google-calendar"),
      esc_html__("Show Today button in calendar toolbar (default: true)", "pretty-google-calendar"),
      esc_html__("Show calendar title in toolbar (default: true)", "pretty-google-calendar"),
      esc_html__("Enable tooltips for events (default: true)", "pretty-google-calendar"),
      esc_html__("Disable links to Google Calendar events (default: false)", "pretty-google-calendar"),
      esc_html__("Primary theme colors: blue, red, green, etc. or hex (#4285f4)", "pretty-google-calendar"),
      esc_html__("Accent color for highlights (optional, uses auto-generated variation if empty)", "pretty-google-calendar"),
      esc_html__("Additional FullCalendar configuration as JSON object", "pretty-google-calendar"),
      esc_html__("Map Parameters:", "pretty-google-calendar"),
      esc_html__("EXCLUSIVE MODE: true=map only, false=calendar only (default: false)", "pretty-google-calendar"),
      esc_html__("Height of the map container (default: 400px)", "pretty-google-calendar"),
      esc_html__("Map center as lat,lng coordinates or address (default: NYC)", "pretty-google-calendar"),
      esc_html__("Use user's current location as map center (default: true)", "pretty-google-calendar"),
      esc_html__("Initial zoom level 1-20, 1=world view (default: 1)", "pretty-google-calendar"),
      esc_html__("Show radius circles around event locations (default: true)", "pretty-google-calendar"),
      esc_html__("Radius distance in miles for event circles (default: 25)", "pretty-google-calendar"),
      esc_html__("Show event popups automatically without clicking (default: false)", "pretty-google-calendar"),
      esc_html__("Show zoom controls and map type buttons (default: true)", "pretty-google-calendar"),
      esc_html__("Show 'Add to Calendar' buttons in event popups (default: true)", "pretty-google-calendar"),
      esc_html__("Show legend below map explaining icons and markers (default: true)", "pretty-google-calendar")
    );
  }

  /**
   * Get the settings option array and print one of its values
   */
  public function pgcal_gapi_callback() {
    printf(
      '<input type="text" id="google_api" name="pgcal_settings[google_api]" value="%s" />',
      isset($this->options['google_api']) ? esc_attr($this->options['google_api']) : ''
    );
  }

  // public function pgcal_tooltip_callback() {
  //   printf(
  //     '<input title="%s" type="checkbox" id="use_tooltip" name="pgcal_settings[use_tooltip]" value="yes" %s />',
  //     esc_html__("Use the popper/tooltip plugin to display event information.", "pretty-google-calendar"),
  //     isset($this->options['use_tooltip']) ? 'checked' : ''
  //   );
  // }

  // public function pgcal_no_link_callback() {
  //   printf(
  //     '<input title="%s" type="checkbox" id="no_link" name="pgcal_settings[no_link]" value="yes" %s />',
  //     esc_html__("Disable the link to the calendar.google.com event.", "pretty-google-calendar"),
  //     isset($this->options['no_link']) ? 'checked' : ''
  //   );
  // }
}
