# Aeon Timer

Aeon Timer is a countdown Next.js application hosted at [Aeon Timer](https://aeon-timer-v2.vercel.app/). It provides users with a versatile countdown feature along with additional functionalities like time, messages, and an auto-countdown feature.

## Presenter v3

The app opens in **Presenter v3**. Choose **Switch to Classic Timer (v2)** to use the original timer and Auto Pilot. Choose **Presenter v3** in Classic to return to the presenter console.

For a quick timer, enter a duration, choose **Show Countdown**, then press **Start Countdown** under the **On Stage** preview. Quick timers do not need a session name.

**Add to Queue** opens a dialog for a required session name and an editable duration. **Save Preset** saves the current duration directly and is disabled when it is already saved. The queue dialog starts with the quick timer's duration; editing it affects only the saved item. Queue items can be edited in a dialog without changing the quick timer or active countdown.

Use **Screen controls & setup → Open Stage** for an extended display or **Single Screen** for fullscreen on the operator’s screen. In Chrome or Edge, allow automatic display placement and use **Fullscreen Stage** from the dashboard. On Windows, choose **Extend** with **Windows + P** before opening the stage.

In Safari, open the stage, drag its window onto the extended display, and choose **Fullscreen** in the stage window. If Safari opens the stage as a tab, choose **Window → Move Tab to New Window** first. Presenter can still confirm the stage window is responding, while its physical display placement remains unverified.

Wait for **Offline ready** on the first visit before disconnecting from the internet. The production build caches the console and stage window locally. The session queue and the current event are also stored in your browser on this device. **End Event** clears the live output and timer while keeping the queue and presets.

Use **Save Queue** to keep a named lineup and **Load Queue** to reuse it. Saved lineups are stored in this browser and work offline. Loading replaces the planned queue while the live timer and stage output continue.

Use **Image → Import Images** to keep PNG, JPEG, and WebP graphics available offline in this browser. A single thumbnail click selects an image privately; **Show Image** or a double-click sends it to stage. **Add to Queue** queues the selected image without changing the stage. Library and queue thumbnails show the graphic; the queue's **Send** action shows it live. **Fit** and **Fill Screen** are available directly under the On Stage preview while an image is live. Fit is the default. Showing an image, clock or message stops and clears the previous countdown.

Clock and Message have **Show Clock** and **Show Message** buttons directly in Prepare output. On Stage controls follow the actual live output independently of the preparation tab. Countdown controls appear only while the countdown is on stage. Save, queue and image action feedback appears as Sonner toasts in the operator console; validation stays beside its fields. Toasts are not shown on the stage display.

**Screen controls & setup** contains display setup, **Blackout Stage**, and **End Event**. **Restore Previous Output** returns from blackout to the previous countdown, clock, message or image, including after a refresh. Blackout does not pause the timer. Ending an event clears its restore state. If a saved image was deleted during blackout, import it again or choose another output.

## Features

### Countdown Feature

- Users can set a countdown timer to track the time until a specific event or deadline.
- The countdown timer displays the remaining time in days, hours, minutes, and seconds.

### Time

- Aeon Timer provides users with the current time, helping them stay organized and aware of the current time.

### Message

- Users can add personalized messages or notes to accompany the countdown, enhancing the user experience and adding context to the event.

### Auto Countdown

- A unique feature of Aeon Timer is the auto-countdown feature.
- Users can schedule durations for different aspects of an event or process.
- The timer seamlessly transitions from one scheduled duration to another automatically.
- This feature is particularly useful for managing events with multiple phases or activities.

## Usage

1. Visit [Aeon Timer](https://aeon-timer-v2.vercel.app/) in your web browser.
2. Set the countdown timer by specifying the target date and time of your event.
3. Optionally, add a personalized message to accompany the countdown.
4. Enable the auto-countdown feature by specifying the durations for different aspects of your event, if applicable.
5. Sit back and let Aeon Timer keep track of your countdown or scheduled durations automatically.

## Technologies Used

- **Next.js 16**: A React framework for building server-side rendered applications.
- **Tailwind CSS**: A utility-first CSS framework for quickly styling web applications.
- **Vercel**: Hosting platform used to deploy the Aeon Timer application.
- **TypeScript**: A typed superset of JavaScript that compiles to plain JavaScript.

## Local Development

Use Node.js 22 or later. Run `npm ci` to install the locked dependencies, then `npm run dev` to start the app.

## Contributing

Contributions are welcome! If you have any suggestions, feature requests, or bug reports, please feel free to open an issue or submit a pull request on the GitHub repository.

## License

This project is licensed under the [MIT License](LICENSE).

## Read-only crew view

Use **Share with crew** in Presenter to create a temporary event code, QR code and link. Crew open `/join` on their phones to see the live countdown, clock, message or image name, alongside current/up-next items. Crew views refresh every 10 seconds while connected; connection warnings appear when data is stale. The local timer and stage keep working offline.

Sharing requires a server-side Upstash Redis integration on Vercel. See [Crew sharing setup and behaviour](docs/crew-sharing.md) and [.env.example](.env.example). Codes survive dashboard refreshes, expire after 24 hours, and are cancelled by **Stop Sharing** or **End Event**. Offline cancellations are retried when the dashboard reconnects.

Crew sharing supports at most **three active viewer sessions per event**. See [Crew protection setup](docs/crew-protection.md) for the Vercel Hobby firewall rule and Upstash PAYG budget settings.
