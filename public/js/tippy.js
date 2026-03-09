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

window.pgcalAddButtonIcons = window.pgcalAddButtonIcons || {
  copy: '<svg class="pgcal-btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true" focusable="false"><path d="M480 400L288 400C279.2 400 272 392.8 272 384L272 128C272 119.2 279.2 112 288 112L421.5 112C425.7 112 429.8 113.7 432.8 116.7L491.3 175.2C494.3 178.2 496 182.3 496 186.5L496 384C496 392.8 488.8 400 480 400zM288 448L480 448C515.3 448 544 419.3 544 384L544 186.5C544 169.5 537.3 153.2 525.3 141.2L466.7 82.7C454.7 70.7 438.5 64 421.5 64L288 64C252.7 64 224 92.7 224 128L224 384C224 419.3 252.7 448 288 448zM160 192C124.7 192 96 220.7 96 256L96 512C96 547.3 124.7 576 160 576L352 576C387.3 576 416 547.3 416 512L416 496L368 496L368 512C368 520.8 360.8 528 352 528L160 528C151.2 528 144 520.8 144 512L144 256C144 247.2 151.2 240 160 240L176 240L176 192L160 192z"/></svg>',
  invite: '<svg class="pgcal-btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true" focusable="false"><path d="M112 128C85.5 128 64 149.5 64 176C64 191.1 71.1 205.3 83.2 214.4L291.2 370.4C308.3 383.2 331.7 383.2 348.8 370.4L556.8 214.4C568.9 205.3 576 191.1 576 176C576 149.5 554.5 128 528 128L112 128zM64 260L64 448C64 483.3 92.7 512 128 512L512 512C547.3 512 576 483.3 576 448L576 260L377.6 408.8C343.5 434.4 296.5 434.4 262.4 408.8L64 260z"/></svg>',
  resend: '<svg class="pgcal-btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" aria-hidden="true" focusable="false"><path d="M64 176C64 149.5 85.5 128 112 128L528 128C554.5 128 576 149.5 576 176L576 257.4C551.6 246.2 524.6 240 496 240C408.3 240 334.3 298.8 311.3 379.2C304.2 377.9 297.2 375 291.2 370.4L83.2 214.4C71.1 205.3 64 191.1 64 176zM304 432C304 460.6 310.2 487.6 321.4 512L128 512C92.7 512 64 483.3 64 448L64 260L262.4 408.8C275 418.2 289.3 424.2 304.1 426.7C304.1 428.5 304 430.2 304 432zM352 432C352 352.5 416.5 288 496 288C575.5 288 640 352.5 640 432C640 511.5 575.5 576 496 576C416.5 576 352 511.5 352 432zM553.4 371.1C546.3 365.9 536.2 367.5 531 374.6L478 447.5L451.2 420.7C445 414.5 434.8 414.5 428.6 420.7C422.4 426.9 422.4 437.1 428.6 443.3L468.6 483.3C471.9 486.6 476.5 488.3 481.2 487.9C485.9 487.5 490.1 485.1 492.9 481.4L556.9 393.4C562.1 386.3 560.5 376.2 553.4 371.1z"/></svg>'
};

window.pgcalAddButtonLabels = window.pgcalAddButtonLabels || {
  copy: 'Copy to Calendar',
  invite: '+ Invite Me',
  resend: 'Resend Invite'
};

window.pgcal_setAddButtonIcon = window.pgcal_setAddButtonIcon || function (button, state, labelOverride) {
  const label = labelOverride || window.pgcalAddButtonLabels[state] || window.pgcalAddButtonLabels.invite;
  const icon = window.pgcalAddButtonIcons[state] || window.pgcalAddButtonIcons.invite;
  button.innerHTML = icon;
  button.setAttribute('title', label);
  button.setAttribute('aria-label', label);
};

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
            title="Checking..."
            aria-label="Checking..."
            disabled>${window.pgcalAddButtonIcons.invite}</button>
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
            style="padding:4px 10px;background:#ff9800;color:#fff;border:none;border-radius:3px;font-size:12px;cursor:pointer;"
            title="${pgcalAddButtonLabels.copy}"
            aria-label="${pgcalAddButtonLabels.copy}">${window.pgcalAddButtonIcons.copy}</button>
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
            window.pgcal_setAddButtonIcon(button, 'resend');
            button.setAttribute("data-resend", "true");
            button.style.background = "#34a853";
          } else {
            window.pgcal_setAddButtonIcon(button, 'invite');
            button.setAttribute("data-resend", "false");
          }
          button.disabled = false;
        })
        .catch((error) => {
          console.error("Attendee check failed:", error);
          window.pgcal_setAddButtonIcon(button, 'invite');
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
            window.pgcal_setAddButtonIcon(button, 'resend');
            button.setAttribute("data-resend", "true");
            button.style.background = "#34a853";
          } else {
            window.pgcal_setAddButtonIcon(button, 'invite');
            button.setAttribute("data-resend", "false");
          }
          button.disabled = false;
        })
        .catch((error) => {
          console.error("Attendee check failed:", error);
          window.pgcal_setAddButtonIcon(button, 'invite');
          button.setAttribute("data-resend", "false");
          button.disabled = false;
        });
    },
  });
}
