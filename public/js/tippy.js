function pgcal_showMobileModal(contentHtml) {
  const existing = document.querySelector('.pgcal-modal-overlay');
  if (existing) {
    existing.remove();
  }

  const overlay = document.createElement('div');
  overlay.className = 'pgcal-modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'pgcal-modal';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'pgcal-modal-close';
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.textContent = 'Close';

  const content = document.createElement('div');
  content.className = 'pgcal-modal-content';
  content.innerHTML = contentHtml;

  closeBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });

  modal.appendChild(closeBtn);
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function pgcal_tippyRender(info, currCal) {
  // console.log(info.event); // DEBUG

  const startTime = info.event.allDay
    ? "All Day"
    : new Date(info.event.startStr).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });

  const endTime = info.event.allDay
    ? ""
    : " - " +
      new Date(info.event.endStr).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });

  const locString = info.event.extendedProps.location
    ? `<p>${info.event.extendedProps.location}</p>`
    : "";

  let toolContent = `
    <h2>${info.event.title} </h2>
    <p>${startTime}${endTime}</p>
    ${locString}`;

  toolContent += pgcal_breakify(
    pgcal_urlify(info.event.extendedProps.description)
  );

  const currentTime = new Date();
  const eventEndTime = info.event.end || info.event.start;
  const isPastEvent = eventEndTime && eventEndTime < currentTime;

  const isLoggedIn = window.pgcal_is_logged_in;
  const canInvite = isLoggedIn && window.pgcal_oauth_valid;

  let eventId = "";
  if (info.event.url && info.event.url.includes("eid=")) {
    eventId = info.event.url.split("eid=")[1]?.split("&")[0] || "";
  }
  if (!eventId) {
    eventId = info.event.id || "";
  }

  const eventTitle = info.event.title || "";
  const location = info.event.extendedProps.location || "";
  const eventUrl = info.event.url || "";
  const startIso = info.event.start ? info.event.start.toISOString() : "";
  const endIso = info.event.end ? info.event.end.toISOString() : startIso;

  let buttonHtml = "";
  if (!isPastEvent && eventId && eventTitle) {
    if (canInvite) {
      buttonHtml = `
        <div style="margin-top:4px;display:flex;align-items:center;gap:8px;">
          <button class="pgcal-add-btn"
            data-mode="invite"
            data-resend="false"
            data-event-id="${eventId}"
            data-event-title="${eventTitle}"
            data-location="${location}"
            data-event-url="${eventUrl}"
            style="padding:4px 10px;background:#4285f4;color:#fff;border:none;border-radius:3px;font-size:12px;cursor:pointer;"
            disabled>Checking...</button>
          <span class="pgcal-add-status" style="display:none;font-size:12px;"></span>
        </div>`;
    } else {
      buttonHtml = `
        <div style="margin-top:4px;display:flex;align-items:center;gap:8px;">
          <button class="pgcal-add-btn"
            data-mode="copy"
            data-event-id="${eventId}"
            data-event-title="${eventTitle}"
            data-location="${location}"
            data-event-url="${eventUrl}"
            data-start="${startIso}"
            data-end="${endIso}"
            style="padding:4px 10px;background:#ff9800;color:#fff;border:none;border-radius:3px;font-size:12px;cursor:pointer;">Copy to Calendar</button>
          <span class="pgcal-add-status" style="display:none;font-size:12px;"></span>
        </div>`;
    }
  }

  toolContent += buttonHtml;

  const isMobile = pgcal_is_mobile();

  // if (isMobile) {
    if (info.el.dataset.pgcalMobileModal === '1') {
      return;
    }

    info.el.dataset.pgcalMobileModal = '1';
    info.el.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      pgcal_showMobileModal(toolContent);

      if (!canInvite || isPastEvent || !eventId) {
        return;
      }

      const ajaxurl = window.pgcal_ajaxurl || (window.pgcal_vars && window.pgcal_vars.ajaxurl);
      if (!ajaxurl) {
        return;
      }

      const button = document.querySelector(
        '.pgcal-modal .pgcal-add-btn[data-mode="invite"]'
      );
      if (!button) {
        return;
      }

      const userEmail = window.pgcaluser_email || "";
      const calendarId = info.event.source?.id || "";

      fetch(ajaxurl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          action: "pgcal_is_attendee",
          event_id: eventId,
          attendee_email: userEmail,
          calendar_id: calendarId,
        }),
      })
        .then((response) => response.json())
        .then((result) => {
          if (result?.data?.isAttendee) {
            button.textContent = "Resend Invite";
            button.setAttribute("data-resend", "true");
            button.style.background = "#34a853";
          } else {
            button.textContent = "+ Invite Me";
            button.setAttribute("data-resend", "false");
          }
          button.disabled = false;
        })
        .catch((error) => {
          console.error("Attendee check failed:", error);
          button.textContent = "+ Invite Me";
          button.setAttribute("data-resend", "false");
          button.disabled = false;
        });
    });
    return;
  // }   //commented out teh outer if block to enable tippy on mobile as well, since the mobile modal is now triggered by a click event listener instead of tippy's onShow

  tippy(info.el, {
    trigger: "click",
    content: toolContent,
    theme: "light", // TODO: from settings
    allowHTML: true,
    placement: isMobile ? "auto" : "auto",
    popperOptions: isMobile
      ? {
          strategy: "fixed",
          modifiers: [
            {
              name: "autoPlacement",
              options: {
                alignment: "end",
                padding: 8,
              },
            },
            {
              name: "flip",
              options: {
                fallbackPlacements: ["top", "bottom", "right", "left"],
              },
            },
            {
              name: "shift",
              options: {
                mainAxis: true,
                crossAxis: true,
                padding: 8,
              },
            },
            {
              name: "preventOverflow",
              options: {
                boundary: "viewport",
                padding: 8,
                altAxis: true,
                tether: true,
              },
            },
          ],
        }
      : "",
    interactive: "true", // Allows clicking inside
    appendTo: isMobile ? document.body : document.getElementById(currCal),
    maxWidth: isMobile ? "calc(100vw - 24px)" : 600, // TODO: from settings
    boundary: isMobile ? "viewport" : "window",
    onShow(instance) {
      if (!canInvite || isPastEvent || !eventId) {
        return;
      }

      const ajaxurl = window.pgcal_ajaxurl || (window.pgcal_vars && window.pgcal_vars.ajaxurl);
      if (!ajaxurl) {
        return;
      }

      const button = instance.popper.querySelector(
        '.pgcal-add-btn[data-mode="invite"]'
      );
      if (!button) {
        return;
      }

      const userEmail = window.pgcaluser_email || "";
      const calendarId = info.event.source?.id || "";

      fetch(ajaxurl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          action: "pgcal_is_attendee",
          event_id: eventId,
          attendee_email: userEmail,
          calendar_id: calendarId,
        }),
      })
        .then((response) => response.json())
        .then((result) => {
          if (result?.data?.isAttendee) {
            button.textContent = "Resend Invite";
            button.setAttribute("data-resend", "true");
            button.style.background = "#34a853";
          } else {
            button.textContent = "+ Invite Me";
            button.setAttribute("data-resend", "false");
          }
          button.disabled = false;
        })
        .catch((error) => {
          console.error("Attendee check failed:", error);
          button.textContent = "+ Invite Me";
          button.setAttribute("data-resend", "false");
          button.disabled = false;
        });
    },
  });
}
