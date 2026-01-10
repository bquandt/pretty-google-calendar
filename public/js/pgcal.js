// document.addEventListener("DOMContentLoaded", function () {

/**
 * Get global settings securely via Ajax
 *
 * @returns global settings
 */
async function pgcalFetchGlobals(ajaxurl) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open("POST", ajaxurl, true);
    xhr.setRequestHeader(
      "Content-Type",
      "application/x-www-form-urlencoded; charset=UTF-8"
    );
    var data = "action=pgcal_ajax_action";
    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        var response = JSON.parse(xhr.responseText);
        resolve(response);
      } else {
        reject("AJAX request failed with status " + xhr.status);
      }
    };
    xhr.send(data);
  });
}

async function pgcal_render_calendar(pgcalSettings, ajaxurl) {
  const globalSettings = await pgcalFetchGlobals(ajaxurl);

  // console.log(globalSettings["google_api"]); // DEBUG

  // Check if we're in map-only mode
  if (pgcalSettings["show_map"] === "true") {
    // Map-only mode - skip calendar rendering and go straight to map
    pgcal_render_map(pgcalSettings, globalSettings);
    return;
  }

  // Calendar-only mode - render calendar as normal
  const currCal = `pgcalendar-${pgcalSettings["id_hash"]}`;
  const calendarEl = document.getElementById(currCal);
  if (!calendarEl) return; // Exit if no calendar container

  calendarEl.innerHTML = "";
  let width = window.innerWidth;

  const views = pgcal_resolve_views(pgcalSettings);
  const cals = pgcal_resolve_cals(pgcalSettings);

  // console.table(cals); // DEBUG
  // console.table(pgcalSettings); // DEBUG
  // console.table(views); // DEBUG

  const toolbarLeft = pgcal_is_truthy(pgcalSettings["show_today_button"])
    ? "prev,next today"
    : "prev,next";
  // Always show the month name above the calendar in Month view
  let toolbarCenter;
  if (views.initial === "dayGridMonth" || (pgcalSettings["force_month_title"] === "true")) {
    toolbarCenter = "title";
  } else {
    toolbarCenter = pgcal_is_truthy(pgcalSettings["show_title"]) ? "title" : "";
  }
  const toolbarRight = views.length > 1 ? views.all.join(",") : "";

  let selectedView = views.initial;

  const pgcalDefaults = {
    locale: pgcalSettings["locale"],
    googleCalendarApiKey: globalSettings["google_api"],

    eventSources: cals,

    views: {
      // Options apply to dayGridMonth, dayGridWeek, and dayGridDay views
      dayGrid: {
        eventTimeFormat: {
          hour: "numeric",
          minute: "2-digit",
          meridiem: "short",
        },
      },
      // Custom List View
      listCustom: {
        type: "list",
        duration: { days: parseInt(pgcalSettings["custom_days"]) },
        buttonText: pgcalSettings["custom_list_button"],
      },
    },

    // Day grid options
    eventDisplay: "block", // Adds border and bocks to events instead of bulleted list (default)
    height: "auto",
    fixedWeekCount: false, // True: 6 weeks, false: flex for month

    // List options
    listDayFormat: { weekday: "long", month: "long", day: "numeric" },

    initialView: views.initial,

    headerToolbar: {
      left: toolbarLeft,
      center: toolbarCenter,
      right: toolbarRight,
    },

    viewDidMount: function (arg) {
      // Ensure the month name is always shown above the calendar in Month view
      if (arg.view.type === "dayGridMonth") {
        const calendarApi = arg.view.calendar;
        calendarApi.setOption("headerToolbar", {
          left: toolbarLeft,
          center: "title",
          right: toolbarRight
        });
      } else {
        const calendarApi = arg.view.calendar;
        calendarApi.setOption("headerToolbar", {
          left: toolbarLeft,
          center: toolbarCenter,
          right: toolbarRight
        });
      }
    },

    eventDidMount: function (info) {
      if (pgcalSettings["use_tooltip"] === "true") {
        pgcal_tippyRender(info, currCal);
      }
    },

    eventClick: function (info) {
      if (
        pgcalSettings["use_tooltip"] === "true" ||
        pgcalSettings["no_link"] === "true"
      ) {
        info.jsEvent.preventDefault(); // Prevent following link
      }
    },

    // Change view on window resize
    windowResize: function (view) {
      // Catch mobile chrome, which changes window size as nav bar appears
      // so only fire if width has changed.
      if (
        window.innerWidth !== width &&
        views.hasList &&
        views.wantsToEnforceListviewOnMobile
      ) {
        if (pgcal_is_mobile()) {
          calendar.changeView(views.listType);
        } else {
          calendar.changeView(selectedView);
        }
      }
    },
  };

  const pgcalOverrides = JSON.parse(pgcalSettings["fc_args"]);
  const pgCalArgs = pgcal_argmerge(pgcalDefaults, pgcalOverrides);

  // console.log(pgcalSettings["fc_args"]); // DEBUG
  // console.log(JSON.stringify(pgcalDefaults, null, 2)); // DEBUG
  // console.log(JSON.stringify(pgCalArgs, null, 2)); // DEBUG

  const calendar = new FullCalendar.Calendar(calendarEl, pgCalArgs);
  calendar.render();

  // Store calendar reference for map integration
  calendarEl._calendar = calendar;
}

/**
 * Render Google Map below the calendar
 */
function pgcal_render_map(pgcalSettings, globalSettings) {
  const mapId = `pgcalmap-${pgcalSettings["id_hash"]}`;
  const mapEl = document.getElementById(mapId);

  if (!mapEl) return;

  // Check if Google Maps API is already loaded or loading
  if (window.google && window.google.maps) {
    // Already loaded
    pgcal_createMap(mapId, pgcalSettings, globalSettings);
  } else if (window.pgcal_maps_loading) {
    // Currently loading, wait for it
    window.pgcal_maps_callbacks = window.pgcal_maps_callbacks || [];
    window.pgcal_maps_callbacks.push(() => pgcal_createMap(mapId, pgcalSettings, globalSettings));
  } else {
    // Need to load
    window.pgcal_maps_loading = true;
    window.pgcal_maps_callbacks = [() => pgcal_createMap(mapId, pgcalSettings, globalSettings)];

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${globalSettings["google_api"]}&callback=pgcal_mapsApiLoaded&loading=async`;
    script.async = true;
    script.defer = true;

    // Global callback for when Maps API loads
    window.pgcal_mapsApiLoaded = function () {
      window.pgcal_maps_loading = false;
      const callbacks = window.pgcal_maps_callbacks || [];
      callbacks.forEach(callback => callback());
      window.pgcal_maps_callbacks = [];
    };

    document.head.appendChild(script);
  }
}

/**
 * Create and initialize the Google Map
 */
function pgcal_createMap(mapId, pgcalSettings, globalSettings) {
  // Store settings globally for onclick handlers
  window.pgcal_current_settings = pgcalSettings;
  
  const mapEl = document.getElementById(mapId);
  if (!mapEl) return;

  // Default location
  const defaultLocation = { lat: 40.7128, lng: -74.0060 }; // New York City

  const map = new google.maps.Map(mapEl, {
    zoom: parseInt(pgcalSettings["map_zoom"] || 10),
    center: defaultLocation,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    zoomControl: pgcalSettings["show_zoom_control"] === "true",
    mapTypeControl: false, // Hide map type selector for cleaner look
    streetViewControl: false, // Hide street view
    fullscreenControl: true // Keep fullscreen option
  });

  // Store map reference for potential future use
  window[`pgcal_map_${pgcalSettings["id_hash"]}`] = map;
  window[`pgcal_map_markers_${pgcalSettings["id_hash"]}`] = [];
  window[`pgcal_map_circles_${pgcalSettings["id_hash"]}`] = [];

  // Handle user location or custom map center
  if (pgcalSettings["use_user_location"] === "true") {
    pgcal_setUserLocationCenter(map, pgcalSettings);
  } else if (pgcalSettings["map_center"] && pgcalSettings["map_center"].trim()) {
    pgcal_setMapCenter(map, pgcalSettings["map_center"]);
  }

  // Add month/today navigation controls
  pgcal_addDateNavigation(map, pgcalSettings, globalSettings);

  // Add zoom level display
  if (pgcalSettings["show_zoom_control"] === "true") {
    pgcal_addZoomDisplay(map, pgcalSettings);
  }

  // Add map legend below the map
  if (pgcalSettings["show_map_legend"] === "true") {
    pgcal_addMapLegend(`pgcalmap-${pgcalSettings["id_hash"]}`, pgcalSettings);
  }

  // Get the calendar instance to access events (calendar mode)
  const calendarEl = document.getElementById(`pgcalendar-${pgcalSettings["id_hash"]}`);
  if (calendarEl && calendarEl._calendar) {
    pgcal_addEventMarkersToMap(map, calendarEl._calendar, pgcalSettings);
  } else {
    // Map-only mode - fetch events directly from Google Calendar API
    pgcal_fetchAndAddEventMarkers(map, pgcalSettings, globalSettings);
  }
}

/**
 * Set map center to user's current location
 */
function pgcal_setUserLocationCenter(map, pgcalSettings) {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        map.setCenter(userLocation);

        // Add a marker for user's location
        const userMarker = new google.maps.Marker({
          position: userLocation,
          map: map,
          title: 'Your Location',
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#34a853">
                <circle cx="12" cy="12" r="8" stroke="#fff" stroke-width="2"/>
                <circle cx="12" cy="12" r="3" fill="#fff"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(24, 24),
            anchor: new google.maps.Point(12, 12)
          }
        });

        // No popup for user location marker

        // Store user location marker
        window[`pgcal_user_marker_${pgcalSettings["id_hash"]}`] = userMarker;
      },
      (error) => {
        console.log('Geolocation error:', error.message);
        // Fallback to default center if geolocation fails
        if (pgcalSettings["map_center"] && pgcalSettings["map_center"].trim()) {
          pgcal_setMapCenter(map, pgcalSettings["map_center"]);
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // Cache location for 5 minutes
      }
    );
  } else {
    console.log('Geolocation not supported');
    // Fallback to default center if geolocation not supported
    if (pgcalSettings["map_center"] && pgcalSettings["map_center"].trim()) {
      pgcal_setMapCenter(map, pgcalSettings["map_center"]);
    }
  }
}

/**
 * Set map center based on coordinates or address
 */
function pgcal_setMapCenter(map, centerValue) {
  // Check if it's lat,lng coordinates
  const coords = centerValue.split(',');
  if (coords.length === 2) {
    const lat = parseFloat(coords[0].trim());
    const lng = parseFloat(coords[1].trim());
    if (!isNaN(lat) && !isNaN(lng)) {
      map.setCenter({ lat: lat, lng: lng });
      return;
    }
  }

  // Otherwise, treat as address and geocode
  const geocoder = new google.maps.Geocoder();
  geocoder.geocode({ address: centerValue }, (results, status) => {
    if (status === 'OK' && results[0]) {
      map.setCenter(results[0].geometry.location);
    }
  });
}

/**
 * Add event markers to the map for events with locations
 */
function pgcal_addEventMarkersToMap(map, calendar, pgcalSettings) {
  console.log('pgcal_addEventMarkersToMap called'); // DEBUG

  const markers = window[`pgcal_map_markers_${pgcalSettings["id_hash"]}`] || [];
  const circles = window[`pgcal_map_circles_${pgcalSettings["id_hash"]}`] || [];

  // Clear existing markers and circles
  markers.forEach(marker => marker.setMap(null));
  circles.forEach(circle => circle.setMap(null));
  markers.length = 0;
  circles.length = 0;

  // Get current events from calendar
  const events = calendar.getEvents();
  console.log('Events received by marker function:', events); // DEBUG
  const geocoder = new google.maps.Geocoder();
  const bounds = new google.maps.LatLngBounds();
  let hasLocations = false;

  events.forEach(event => {
    const location = event.extendedProps.location;
    if (location && location.trim()) {
      // Check if event is in the past (do this outside geocoding callback)
      const currentTime = new Date();
      const eventEndTime = event.end || event.start;
      const isEventPast = eventEndTime < currentTime;

      // Geocode the location
      geocoder.geocode({ address: location }, (results, status) => {
        if (status === 'OK' && results[0]) {
          hasLocations = true;
          const position = results[0].geometry.location;

          const marker = new google.maps.Marker({
            position: position,
            map: map,
            title: event.title,
            icon: {
              url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${isEventPast ? '#ff6b6b' : '#4285f4'}">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                  ${isEventPast ? '<text x="12" y="16" font-family="Arial" font-size="8" fill="white" text-anchor="middle">✓</text>' : ''}
                </svg>
              `),
              scaledSize: new google.maps.Size(24, 24),
              anchor: new google.maps.Point(12, 24)
            }
          });

          // Generate calendar URLs for "Add to Calendar"
          const calendarUrls = pgcal_generateCalendarUrls(event, location);

          // Extract the FULL event ID from the URL (eid parameter has the complete ID)
          // Fallback to event.id only if URL extraction fails (event.id is often truncated)
          let eventId = '';
          if (event.url && event.url.includes('eid=')) {
            eventId = event.url.split('eid=')[1]?.split('&')[0] || '';
          }
          if (!eventId) {
            eventId = event.id || '';
          }
          console.log('🔍 The new Full event ID extracted:', eventId);
          console.log('🔗 Event URL:', event.url);
          console.log('📝 event.id (short):', event.id);

          // Create info window
          const infoWindow = new google.maps.InfoWindow({
            content: `
              <div id="popup-${eventId}" style="max-width: 400px; min-width: 350px; ${isEventPast ? 'opacity: 0.75; background-color: #f9f9f9;' : ''}" class="pgcal-popup-content">
                <h3 style="margin: 0 0 10px 0; font-size: 20px; line-height: 1.3; color: ${isEventPast ? '#888' : '#333'}; font-weight: 600; border-bottom: 1px solid #eee; padding-bottom: 6px;">
                  ${event.title}
                  ${isEventPast ? '<span style="background: #ff6b6b; color: white; font-size: 13px; padding: 2px 6px; border-radius: 10px; margin-left: 8px; font-weight: normal;">PAST</span>' : ''}
                </h3>
                <p style="margin: 6px 0; color: ${isEventPast ? '#888' : '#666'}; font-size: 16px; line-height: 1.5;">
                  <strong style="color: ${isEventPast ? '#ff6b6b' : '#4285f4'}; font-size: 16px;">Date:</strong> ${event.start.toLocaleDateString()}
                </p>
                ${event.start.getHours() !== 0 || event.start.getMinutes() !== 0 ?
                `<p style="margin: 6px 0; color: ${isEventPast ? '#888' : '#666'}; font-size: 16px; line-height: 1.5;">
                    <strong style="color: ${isEventPast ? '#ff6b6b' : '#4285f4'}; font-size: 16px;">Time:</strong> ${event.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </p>` : ''
              }
                <p style="margin: 6px 0 0 0; color: ${isEventPast ? '#888' : '#666'}; font-size: 16px; line-height: 1.5;">
                  <strong style="color: ${isEventPast ? '#ff6b6b' : '#4285f4'}; font-size: 16px;">Location:</strong> ${location}
                </p>
                ${event.extendedProps.description ? `
                  <div style="margin: 8px 0; padding: 8px; background-color: ${isEventPast ? '#f5f5f5' : '#f8f9ff'}; border-radius: 4px; border-left: 3px solid ${isEventPast ? '#ff6b6b' : '#4285f4'};">
                    <p style="margin: 0; color: ${isEventPast ? '#666' : '#555'}; font-size: 16px; line-height: 1.5;">
                      <strong style="color: ${isEventPast ? '#ff6b6b' : '#4285f4'}; font-size: 16px;">Description:</strong><br>
                      ${event.extendedProps.description.replace(/\n/g, '<br>')}
                    </p>
                  </div>
                ` : ''}
                ${pgcalSettings["show_add_to_calendar"] === "true" ? `
                  <div style="margin: 12px 0 8px 0;">
                    <button class="pgcal-add-btn" data-event-id="${eventId}" data-event-url="${event.url || ''}" data-location="${location}" data-event-title="${event.title}" style="display: inline-block; padding: 10px 20px; background: #4285f4; color: white; border: none; border-radius: 4px; font-size: 16px; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; cursor: pointer; transition: background 0.3s;">Add to Calendar</button>
                    <span class="pgcal-add-status" style="display: none; margin-left: 10px; font-size: 14px;"></span>
                  </div>
                ` : ''}
                ${isEventPast ? '<p style="margin: 8px 0 0 0; font-size: 14px; line-height: 1.5; color: #ff6b6b; font-style: italic;">This event has already occurred</p>' : ''}
              </div>
            `,
            pixelOffset: new google.maps.Size(0, -10)
          });

          // Show info window by default if enabled
          if (pgcalSettings["popups_open"] === "true") {
            infoWindow.open(map, marker);
          }

          // Allow clicking to toggle
          marker.addListener('click', () => {
            if (infoWindow.getMap()) {
              infoWindow.close();
            } else {
              infoWindow.open(map, marker);
            }
          });

          markers.push(marker);
          bounds.extend(position);

          // Add radius circle if enabled
          if (pgcalSettings["show_radius"] === "true") {
            const radiusMiles = parseFloat(pgcalSettings["radius_miles"] || 25);
            const radiusMeters = radiusMiles * 1609.34; // Convert miles to meters

            const circle = new google.maps.Circle({
              strokeColor: '#4285f4',
              strokeOpacity: 0.6,
              strokeWeight: 1,
              fillColor: '#4285f4',
              fillOpacity: 0.1,
              map: map,
              center: position,
              radius: radiusMeters
            });

            circles.push(circle);
          }

          // Note: Removed automatic map fitting to prevent unwanted zoom changes when switching months
          // Users can manually adjust zoom and pan as needed
        }
      });
    }
  });

  // Update the stored markers and circles arrays
  window[`pgcal_map_markers_${pgcalSettings["id_hash"]}`] = markers;
  window[`pgcal_map_circles_${pgcalSettings["id_hash"]}`] = circles;
}

/**
 * Add radius toggle button to the map
 */
function pgcal_addRadiusToggle(map, pgcalSettings) {
  // Create toggle button
  const toggleButton = document.createElement('div');
  toggleButton.style.backgroundColor = 'white';
  toggleButton.style.border = '2px solid #fff';
  toggleButton.style.borderRadius = '3px';
  toggleButton.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
  toggleButton.style.cursor = 'pointer';
  toggleButton.style.fontFamily = 'Roboto,Arial,sans-serif';
  toggleButton.style.fontSize = '16px';
  toggleButton.style.lineHeight = '38px';
  toggleButton.style.margin = '8px 0 22px';
  toggleButton.style.padding = '0 5px';
  toggleButton.style.textAlign = 'center';
  toggleButton.style.minWidth = '120px';
  toggleButton.textContent = `Hide ${pgcalSettings["radius_miles"]}mi Radius`;
  toggleButton.title = 'Toggle radius circles around event locations';

  // Store toggle state
  window[`pgcal_radius_visible_${pgcalSettings["id_hash"]}`] = true;

  // Add click handler
  toggleButton.addEventListener('click', () => {
    const circles = window[`pgcal_map_circles_${pgcalSettings["id_hash"]}`] || [];
    const isVisible = window[`pgcal_radius_visible_${pgcalSettings["id_hash"]}`];

    circles.forEach(circle => {
      circle.setVisible(!isVisible);
    });

    window[`pgcal_radius_visible_${pgcalSettings["id_hash"]}`] = !isVisible;
    toggleButton.textContent = isVisible ?
      `Show ${pgcalSettings["radius_miles"]}mi Radius` :
      `Hide ${pgcalSettings["radius_miles"]}mi Radius`;
  });

  // Add button to map
  map.controls[google.maps.ControlPosition.TOP_RIGHT].push(toggleButton);
}

/**
 * Add zoom level display to the map
 */
function pgcal_addZoomDisplay(map, pgcalSettings) {
  // Create zoom display
  const zoomDisplay = document.createElement('div');
  zoomDisplay.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
  zoomDisplay.style.border = '1px solid #ddd';
  zoomDisplay.style.borderRadius = '2px';
  zoomDisplay.style.boxShadow = '0 1px 3px rgba(0,0,0,.2)';
  zoomDisplay.style.fontFamily = 'Roboto,Arial,sans-serif';
  zoomDisplay.style.fontSize = '11px';
  zoomDisplay.style.lineHeight = '24px';
  zoomDisplay.style.margin = '8px';
  zoomDisplay.style.padding = '0 6px';
  zoomDisplay.style.textAlign = 'center';
  zoomDisplay.style.minWidth = '50px';
  zoomDisplay.style.color = '#666';
  zoomDisplay.textContent = `Zoom: ${map.getZoom()}`;
  zoomDisplay.title = 'Current zoom level (use +/- buttons to adjust)';

  // Update display when zoom changes
  map.addListener('zoom_changed', () => {
    zoomDisplay.textContent = `Zoom: ${map.getZoom()}`;
  });

  // Add to map (top right, off to the side)
  map.controls[google.maps.ControlPosition.TOP_RIGHT].push(zoomDisplay);
}

/**
 * Generate calendar URLs for "Add to Calendar" functionality
 */
function pgcal_generateCalendarUrls(event, location) {
  const title = encodeURIComponent(event.title);
  const details = encodeURIComponent(event.extendedProps.description || '');
  const loc = encodeURIComponent(location);

  // Format dates for calendar URLs
  const startDate = event.start;
  const endDate = event.end || new Date(startDate.getTime() + (60 * 60 * 1000)); // Default 1 hour if no end

  // Check if it's an all-day event
  const isAllDay = (startDate.getHours() === 0 && startDate.getMinutes() === 0 &&
    endDate.getHours() === 0 && endDate.getMinutes() === 0);

  let startStr, endStr;
  if (isAllDay) {
    // All-day event format: YYYYMMDD
    startStr = startDate.toISOString().slice(0, 10).replace(/-/g, '');
    const nextDay = new Date(endDate);
    nextDay.setDate(nextDay.getDate()); // Keep the same date for all-day events
    endStr = nextDay.toISOString().slice(0, 10).replace(/-/g, '');
  } else {
    // Timed event format: YYYYMMDDTHHMMSSZ
    startStr = startDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    endStr = endDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  }

  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${loc}`,
    outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate.toISOString()}&enddt=${endDate.toISOString()}&body=${details}&location=${loc}`,
    yahoo: `https://calendar.yahoo.com/?v=60&view=d&type=20&title=${title}&st=${startStr}&et=${endStr}&desc=${details}&in_loc=${loc}`,
    ics: `data:text/calendar;charset=utf8,BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Pretty Google Calendar//EN
BEGIN:VEVENT
UID:${Date.now()}-${Math.random().toString(36).substr(2, 9)}@prettygooglecalendar.com
DTSTART:${startStr}
DTEND:${endStr}
SUMMARY:${event.title}
DESCRIPTION:${event.extendedProps.description || ''}
LOCATION:${location}
END:VEVENT
END:VCALENDAR`.replace(/\n/g, '%0A')
  };
}

/**
 * Add map legend below the map container
 */
function pgcal_addMapLegend(mapId, pgcalSettings) {
  const mapContainer = document.getElementById(mapId);
  if (!mapContainer) return;

  // Create legend container
  const legendContainer = document.createElement('div');
  legendContainer.id = `pgcal-legend-${pgcalSettings["id_hash"]}`;
  legendContainer.style.cssText = `
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 12px 16px;
    margin-top: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    font-family: Roboto, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.4;
  `;

  // Create legend title
  const legendTitle = document.createElement('div');
  legendTitle.textContent = 'Map Legend';
  legendTitle.style.cssText = `
    font-weight: 600;
    color: #333;
    margin-bottom: 8px;
    font-size: 14px;
  `;

  // Create legend items container
  const legendItems = document.createElement('div');
  legendItems.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
  `;

  // Event marker (future events)
  const futureEventItem = document.createElement('div');
  futureEventItem.style.cssText = 'display: flex; align-items: center; gap: 6px;';
  futureEventItem.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#4285f4">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
    </svg>
    <span style="color: #333;">Upcoming Events</span>
  `;

  // Event marker (past events)
  const pastEventItem = document.createElement('div');
  pastEventItem.style.cssText = 'display: flex; align-items: center; gap: 6px;';
  pastEventItem.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#ff6b6b">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      <text x="12" y="16" font-family="Arial" font-size="8" fill="white" text-anchor="middle">✓</text>
    </svg>
    <span style="color: #333;">Past Events</span>
  `;

  // User location marker (if enabled)
  const userLocationItem = document.createElement('div');
  userLocationItem.style.cssText = 'display: flex; align-items: center; gap: 6px;';
  userLocationItem.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#34a853">
      <circle cx="12" cy="12" r="8" stroke="#fff" stroke-width="2"/>
      <circle cx="12" cy="12" r="3" fill="#fff"/>
    </svg>
    <span style="color: #333;">Your Location</span>
  `;

  // Radius circles (if enabled)
  const radiusItem = document.createElement('div');
  radiusItem.style.cssText = 'display: flex; align-items: center; gap: 6px;';
  radiusItem.innerHTML = `
    <div style="width: 20px; height: 20px; border: 2px solid #4285f4; border-radius: 50%; background: rgba(66, 133, 244, 0.1); position: relative;">
      <div style="width: 4px; height: 4px; background: #4285f4; border-radius: 50%; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);"></div>
    </div>
    <span style="color: #333;">${pgcalSettings["radius_miles"] || '25'} mile radius</span>
  `;

  // Add legend items based on enabled features
  legendItems.appendChild(futureEventItem);
  legendItems.appendChild(pastEventItem);

  if (pgcalSettings["use_user_location"] === "true") {
    legendItems.appendChild(userLocationItem);
  }

  if (pgcalSettings["show_radius"] === "true") {
    legendItems.appendChild(radiusItem);
  }

  // Assemble legend
  legendContainer.appendChild(legendTitle);
  legendContainer.appendChild(legendItems);

  // Insert legend after map container
  mapContainer.parentNode.insertBefore(legendContainer, mapContainer.nextSibling);
}

/**
 * Add month/today navigation controls to the map
 */
function pgcal_addDateNavigation(map, pgcalSettings, globalSettings) {
  // Initialize current date for navigation
  if (!window[`pgcal_current_date_${pgcalSettings["id_hash"]}`]) {
    window[`pgcal_current_date_${pgcalSettings["id_hash"]}`] = new Date();
  }
  const currentDate = window[`pgcal_current_date_${pgcalSettings["id_hash"]}`];

  // Create navigation container
  const navContainer = document.createElement('div');
  navContainer.style.display = 'flex';
  navContainer.style.gap = '8px';
  navContainer.style.margin = '8px 0 12px';
  navContainer.style.alignItems = 'center';

  // Combined Today/Date button
  const todayButton = document.createElement('div');
  todayButton.style.backgroundColor = 'white';
  todayButton.style.border = '2px solid #fff';
  todayButton.style.borderRadius = '3px';
  todayButton.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
  todayButton.style.cursor = 'pointer';
  todayButton.style.fontFamily = 'Roboto,Arial,sans-serif';
  todayButton.style.fontSize = '13px';
  todayButton.style.lineHeight = '32px';
  todayButton.style.padding = '0 12px';
  todayButton.style.textAlign = 'center';
  todayButton.style.minWidth = '120px';

  // Update today button display function
  function updateTodayButton() {
    const now = new Date();
    const options = {
      month: 'short',
      day: 'numeric'
    };
    const isToday = (currentDate.toDateString() === now.toDateString());

    if (isToday) {
      todayButton.textContent = `Today (${now.toLocaleDateString('en-US', options)})`;
      todayButton.title = 'Show events from today onwards (not limited to just today)';
    } else {
      todayButton.textContent = `Today (${now.toLocaleDateString('en-US', options)})`;
      todayButton.title = 'Jump to today and show events from today onwards (not limited to just today)';
    }
  }

  // Previous month button
  const prevButton = document.createElement('div');
  prevButton.style.backgroundColor = 'white';
  prevButton.style.border = '2px solid #fff';
  prevButton.style.borderRadius = '3px';
  prevButton.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
  prevButton.style.cursor = 'pointer';
  prevButton.style.fontFamily = 'Roboto,Arial,sans-serif';
  prevButton.style.fontSize = '16px';
  prevButton.style.lineHeight = '32px';
  prevButton.style.padding = '0 8px';
  prevButton.style.textAlign = 'center';
  prevButton.style.fontWeight = 'bold';
  prevButton.textContent = '‹';
  prevButton.title = 'Previous month';

  // Current Month button
  const monthButton = document.createElement('div');
  monthButton.style.backgroundColor = 'white';
  monthButton.style.border = '2px solid #fff';
  monthButton.style.borderRadius = '3px';
  monthButton.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
  monthButton.style.cursor = 'pointer';
  monthButton.style.fontFamily = 'Roboto,Arial,sans-serif';
  monthButton.style.fontSize = '14px';
  monthButton.style.lineHeight = '32px';
  monthButton.style.padding = '0 12px';
  monthButton.style.textAlign = 'center';
  monthButton.style.minWidth = '100px';

  // Next month button
  const nextButton = document.createElement('div');
  nextButton.style.backgroundColor = 'white';
  nextButton.style.border = '2px solid #fff';
  nextButton.style.borderRadius = '3px';
  nextButton.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
  nextButton.style.cursor = 'pointer';
  nextButton.style.fontFamily = 'Roboto,Arial,sans-serif';
  nextButton.style.fontSize = '16px';
  nextButton.style.lineHeight = '32px';
  nextButton.style.padding = '0 8px';
  nextButton.style.textAlign = 'center';
  nextButton.style.fontWeight = 'bold';
  nextButton.textContent = '›';
  nextButton.title = 'Next month';

  // Update month button text function
  function updateMonthButton() {
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];

    // Always show the actual month name, never "This Month"
    monthButton.textContent = monthNames[currentDate.getMonth()];
    monthButton.title = `Show events from ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()} only`;
  }

  // Initialize past_days_limit if not set, default to current month behavior
  if (!pgcalSettings["past_days_limit"]) {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysSinceFirstOfMonth = Math.floor((now - firstOfMonth) / (1000 * 60 * 60 * 24));
    pgcalSettings["past_days_limit"] = daysSinceFirstOfMonth.toString();
  }

  // Function to update button styles
  function updateButtonStyles(activeButton) {
    // Reset all buttons
    todayButton.style.backgroundColor = 'white';
    todayButton.style.color = 'black';
    monthButton.style.backgroundColor = 'white';
    monthButton.style.color = 'black';
    prevButton.style.backgroundColor = 'white';
    prevButton.style.color = 'black';
    nextButton.style.backgroundColor = 'white';
    nextButton.style.color = 'black';

    // Highlight active button
    if (activeButton) {
      activeButton.style.backgroundColor = '#4285f4';
      activeButton.style.color = 'white';
    }
  }

  // Function to calculate past_days_limit for a given date (for "onwards" behavior)
  function calculatePastDaysLimit(targetDate) {
    const now = new Date();
    const firstOfTargetMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const daysSinceFirstOfMonth = Math.floor((now - firstOfTargetMonth) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysSinceFirstOfMonth);
  }

  // Function to set date range for specific month only
  function setMonthOnlyRange(targetDate) {
    const firstOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
    const lastOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

    // Store the specific month range in pgcalSettings
    pgcalSettings["month_only_mode"] = "true";
    pgcalSettings["month_start"] = firstOfMonth.toISOString();
    pgcalSettings["month_end"] = lastOfMonth.toISOString();
  }

  // Function to clear month-only mode (for Today button)
  function clearMonthOnlyMode() {
    pgcalSettings["month_only_mode"] = "false";
    delete pgcalSettings["month_start"];
    delete pgcalSettings["month_end"];
  }

  // Today button click handler
  todayButton.addEventListener('click', () => {
    // Reset to actual today
    window[`pgcal_current_date_${pgcalSettings["id_hash"]}`] = new Date();
    const newCurrentDate = window[`pgcal_current_date_${pgcalSettings["id_hash"]}`];

    // Clear month-only mode and set to today onwards
    clearMonthOnlyMode();
    pgcalSettings["past_days_limit"] = "0";

    // Update displays
    updateTodayButton();
    updateMonthButton();

    // Refresh map markers
    pgcal_refreshMapMarkers(map, pgcalSettings, globalSettings);

    // Update button styles
    updateButtonStyles(todayButton);
  });

  // Previous month button click handler
  prevButton.addEventListener('click', () => {
    // Move to previous month
    currentDate.setMonth(currentDate.getMonth() - 1);

    // Set month-only mode for this specific month
    setMonthOnlyRange(currentDate);

    // Update displays
    updateTodayButton();
    updateMonthButton();

    // Refresh map markers
    pgcal_refreshMapMarkers(map, pgcalSettings, globalSettings);

    // Update button styles
    updateButtonStyles(monthButton);
  });

  // Next month button click handler
  nextButton.addEventListener('click', () => {
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);

    // Set month-only mode for this specific month
    setMonthOnlyRange(currentDate);

    // Update displays
    updateTodayButton();
    updateMonthButton();

    // Refresh map markers
    pgcal_refreshMapMarkers(map, pgcalSettings, globalSettings);

    // Update button styles
    updateButtonStyles(monthButton);
  });

  // Month button click handler (reset to current month)
  monthButton.addEventListener('click', () => {
    // Reset to current month
    window[`pgcal_current_date_${pgcalSettings["id_hash"]}`] = new Date();
    const newCurrentDate = window[`pgcal_current_date_${pgcalSettings["id_hash"]}`];

    // Set month-only mode for current month
    setMonthOnlyRange(newCurrentDate);

    // Update displays
    updateTodayButton();
    updateMonthButton();

    // Refresh map markers
    pgcal_refreshMapMarkers(map, pgcalSettings, globalSettings);

    // Update button styles
    updateButtonStyles(monthButton);
  });

  // Initialize with current month-only mode by default
  setMonthOnlyRange(currentDate);

  // Initialize displays
  updateTodayButton();
  updateMonthButton();

  // Set initial button state (Month active by default)
  updateButtonStyles(monthButton);

  // Add buttons to container in order
  navContainer.appendChild(todayButton);
  navContainer.appendChild(prevButton);
  navContainer.appendChild(monthButton);
  navContainer.appendChild(nextButton);

  // Add container to map (top left)
  map.controls[google.maps.ControlPosition.TOP_LEFT].push(navContainer);
}

/**
 * Refresh map markers with current date filter settings
 */
function pgcal_refreshMapMarkers(map, pgcalSettings, globalSettings) {
  // Clear existing markers
  const markers = window[`pgcal_map_markers_${pgcalSettings["id_hash"]}`] || [];
  const circles = window[`pgcal_map_circles_${pgcalSettings["id_hash"]}`] || [];

  markers.forEach(marker => marker.setMap(null));
  circles.forEach(circle => circle.setMap(null));

  // Reset arrays
  window[`pgcal_map_markers_${pgcalSettings["id_hash"]}`] = [];
  window[`pgcal_map_circles_${pgcalSettings["id_hash"]}`] = [];

  // Fetch fresh events with new date range
  pgcal_fetchAndAddEventMarkers(map, pgcalSettings, globalSettings);
}

/**
 * Fetch events directly from Google Calendar API for map-only mode
 */
function pgcal_fetchAndAddEventMarkers(map, pgcalSettings, globalSettings) {
  const calendarIds = pgcalSettings["gcal"].split(",");

  calendarIds.forEach((calendarId, index) => {
    const trimmedId = calendarId.trim();
    if (!trimmedId) return;

    // Create a date range based on month_only_mode or past_days_limit parameter
    let timeMin, timeMax;

    if (pgcalSettings["month_only_mode"] === "true") {
      // Use specific month range
      timeMin = pgcalSettings["month_start"];
      timeMax = pgcalSettings["month_end"];
    } else {
      // Use past_days_limit for "onwards" behavior (Today button)
      const now = new Date();
      const pastDaysLimit = parseInt(pgcalSettings["past_days_limit"] || 30);
      const pastLimitDate = new Date();
      pastLimitDate.setDate(now.getDate() - pastDaysLimit);
      const oneYearLater = new Date();
      oneYearLater.setFullYear(now.getFullYear() + 1);

      timeMin = pastLimitDate.toISOString();
      timeMax = oneYearLater.toISOString();
    }

    // Fetch events from Google Calendar API
    const apiUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(trimmedId)}/events?key=${globalSettings["google_api"]}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=500`;

    fetch(apiUrl)
      .then(response => response.json())
      .then(data => {
        console.log('API Response:', data); // DEBUG
        if (data.items && data.items.length > 0) {
          console.log('First item from API:', data.items[0]); // DEBUG
          console.log('First item.id:', data.items[0].id); // DEBUG
          console.log('First item.htmlLink:', data.items[0].htmlLink); // DEBUG
          // Convert Google Calendar events to FullCalendar-like format
          const events = data.items.map(item => ({
            id: item.id,
            title: item.summary || 'No Title',
            start: new Date(item.start.dateTime || item.start.date),
            end: new Date(item.end.dateTime || item.end.date),
            extendedProps: {
              location: item.location || '',
              description: item.description || ''
            },
            url: item.htmlLink
          }));

          console.log('Converted events:', events); // DEBUG
          console.log('Events with locations:', events.filter(e => e.extendedProps.location)); // DEBUG

          // Create a fake calendar object for compatibility
          const fakeCalendar = {
            getEvents: () => events
          };

          // Add markers to map
          pgcal_addEventMarkersToMap(map, fakeCalendar, pgcalSettings);
        } else {
          console.log('No events found in API response'); // DEBUG
        }
      })
      .catch(error => {
        console.error('Error fetching calendar events:', error);
        console.log('API URL:', apiUrl); // DEBUG
      });
  });
}

/**
 * Add to Calendar - Primary method using Google Calendar API
 * Falls back to calendar URL method if API call fails
 */
// Add-to-calendar flow (map mode):
// - event.id is the composite eid from Google (base64 of "<eventId> <calendarId>@g")
// - calendarId is extracted from event.url cid= if present; otherwise we send primary and let PHP decode the composite
// - We optimistically disable the button, call WP AJAX, and re-enable/fallback to URL on failure
function pgcal_addToCalendar(event, calendarUrls, pgcalSettings, statusEl = null, btn = null) {
  const eventId = event.id;
  
  // If statusEl/btn not provided, try to find them (fallback for old calls)
  if (!statusEl) statusEl = document.querySelector(`[data-event-id="${eventId}"]`)?.parentElement?.querySelector('.pgcal-add-status');
  if (!btn) btn = document.querySelector(`[data-event-id="${eventId}"]`);
  
  console.log('🔵 pgcal_addToCalendar called with event:', { eventId, event });
  
  if (!statusEl || !btn) {
    console.error('❌ Missing status or button elements for event:', eventId);
    return;
  }

  // Show loading state
  btn.disabled = true;
  btn.style.opacity = '0.7';
  statusEl.style.display = 'inline';
  statusEl.textContent = 'Adding...';
  statusEl.style.color = '#ff9800';

  // Extract calendar ID from event URL if available (format: https://www.google.com/calendar/event?eid=COMPOSITE_ID&cid=CALENDAR_ID)
  let calendarId = 'primary';
  if (event.url && event.url.includes('cid=')) {
    const cidMatch = event.url.match(/cid=([^&]+)/);
    if (cidMatch && cidMatch[1]) {
      calendarId = decodeURIComponent(cidMatch[1]);
      console.log('📋 Extracted calendar ID from URL:', calendarId);
    }
  }
  // If still no calendar ID from URL, send the raw event ID (composite) and let PHP decode it
  if (calendarId === 'primary') {
    console.log('📋 Using default calendar ID (primary), PHP will extract from composite ID if needed');
  }

  const requestBody = `action=pgcal_add_to_calendar&event_id=${encodeURIComponent(eventId)}&calendar_id=${encodeURIComponent(calendarId)}`;
  console.log('📤 Sending AJAX request to:', pgcal_vars.ajaxurl);
  console.log('📋 Request body:', requestBody);

  // First attempt: Call WordPress AJAX handler to add attendee via Google Calendar API
  fetch(pgcal_vars.ajaxurl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
    body: requestBody,
  })
    .then(response => {
      console.log('📥 Response status:', response.status, response.statusText);
      console.log('📥 Response headers:', {
        'content-type': response.headers.get('content-type')
      });
      return response.text().then(text => {
        console.log('📥 Raw response body:', text);
        try {
          return JSON.parse(text);
        } catch (e) {
          throw new Error(`Failed to parse JSON: ${e.message}. Raw text: ${text}`);
        }
      });
    })
    .then(data => {
      console.log('✅ Add to Calendar API Response (parsed):', data);
      
      if (data.success) {
        console.log('🎉 API call succeeded!');
        // API call succeeded
        statusEl.textContent = '✓ Added!';
        statusEl.style.color = '#4caf50';
        btn.style.background = '#4caf50';
        
        setTimeout(() => {
          statusEl.style.display = 'none';
          btn.disabled = false;
          btn.style.opacity = '1';
        }, 2000);
      } else {
        // API call failed, use fallback: open calendar URL
        console.warn('⚠️ API request returned success=false. Error:', data.data?.message || data.message);
        console.log('📞 Falling back to calendar URL method...');
        pgcal_addToCalendarFallback(calendarUrls, statusEl, btn);
      }
    })
    .catch(error => {
      // Network error or other issue, use fallback
      console.error('❌ Error calling add to calendar API:', error);
      console.log('📞 Falling back to calendar URL method...');
      pgcal_addToCalendarFallback(calendarUrls, statusEl, btn);
    });
}

/**
 * Fallback method: Open calendar URL in new tab
 */
function pgcal_addToCalendarFallback(calendarUrls, statusEl, btn) {
  statusEl.textContent = '✓ Opening calendar...';
  statusEl.style.color = '#4caf50';
  btn.style.background = '#4caf50';
  
  // Open Google Calendar template in new tab
  window.open(calendarUrls.google, '_blank');
  
  setTimeout(() => {
    statusEl.style.display = 'none';
    btn.disabled = false;
    btn.style.opacity = '1';
  }, 2000);
}

/**
 * Attach event delegation listener for "Add to Calendar" buttons
 * This uses event delegation to catch all button clicks, even dynamically added ones
 */
document.addEventListener('click', function(e) {
  if (e.target.classList && e.target.classList.contains('pgcal-add-btn')) {
    e.preventDefault();
    e.stopPropagation();
    
    const btn = e.target;
    let eventId = btn.getAttribute('data-event-id');
    const eventUrl = btn.getAttribute('data-event-url');
    const location = btn.getAttribute('data-location');
    const eventTitle = btn.getAttribute('data-event-title');
    
    // Extract event ID from URL if it's undefined or the string "undefined"
    if (!eventId || eventId === 'undefined' || eventId === '') {
      if (eventUrl && eventUrl.includes('eid=')) {
        eventId = eventUrl.split('eid=')[1]?.split('&')[0] || '';
        console.log('📤 Extracted event ID from URL:', eventId);
      }
    }
    
    console.log(' Full burron element:', btn);
    console.log(' data-event-id attribute:', eventId);
    console.log(' data-event-url attribute:', eventUrl);
    console.log(' data-location attribute:', location);
    console.log(' data-event-title attribute:', eventTitle);
    console.log('all data attributes:', btn.dataset);

    console.log('🔵 "Add to Calendar" button clicked!');
    console.log('📝 Event ID:', eventId);
    console.log('📍 Location:', location);
    console.log('📌 Title:', eventTitle);
    console.log('🔗 Event URL:', eventUrl);
    
    // Create event object from data attributes
    const event = { 
      id: eventId,
      title: eventTitle,
      url: eventUrl
    };
    
    // Get pgcalSettings from window
    let pgcalSettings = window.pgcal_current_settings;
    if (!pgcalSettings) {
      console.warn('⚠️ pgcalSettings not found, using defaults');
      pgcalSettings = {};
    }
    
    // Generate calendar URLs - get status and button from the popup
    const popup = btn.closest('.pgcal-popup-content');
    let statusEl = null;
    if (popup) {
      statusEl = popup.querySelector('.pgcal-add-status');
    }
    
    if (!statusEl) {
      console.warn('⚠️ Status element not found, creating one');
      statusEl = document.createElement('span');
      statusEl.className = 'pgcal-add-status';
      statusEl.style.display = 'none';
      statusEl.style.marginLeft = '10px';
      statusEl.style.fontSize = '14px';
      btn.parentElement.appendChild(statusEl);
    }
    
    const calendarUrls = {
      google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&location=${encodeURIComponent(location)}`
    };
    
    console.log('🔗 Generated calendar URL');
    
    // Call the main handler
    pgcal_addToCalendar(event, calendarUrls, pgcalSettings, statusEl, btn);
  }
}, true); // Use capture phase to ensure we catch the event first

// Add a button to log current user details
// document.addEventListener("DOMContentLoaded", function () {
//   const logUserButton = document.createElement("button");
//   logUserButton.textContent = "Log The Current User NOW";
//   logUserButton.style.margin = "10px";
//   logUserButton.addEventListener("click", function () {
//     fetch(pgcal_vars.ajaxurl, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
//       },
//       body: "action=pgcal_log_user_details",
//     })
//       .then((response) => response.json())
//       .then((data) => {
//         console.log("User Details:", data);
//       })
//       .catch((error) => {
//         console.error("Error logging user details:", error);
//       });
//   });

//   document.body.appendChild(logUserButton);
// });


