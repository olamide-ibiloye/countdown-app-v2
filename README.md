# Aeon Timer

Aeon Timer is a countdown Next.js application hosted at [Aeon Timer](https://aeon-timer-v2.vercel.app/). It provides users with a versatile countdown feature along with additional functionalities like time, messages, and an auto-countdown feature.

## Presenter v3

Choose **Try Presenter v3** from Classic to open the presenter console. The **Classic v2** link returns to the original timer and Auto Pilot.

Use **Open Stage** for an extended display or **Single Screen** for fullscreen on the operator’s screen. In Chrome or Edge, allow automatic display placement and use **Fullscreen Stage** from the dashboard. On Windows, choose **Extend** with **Windows + P** before opening the stage.

In Safari, open the stage, drag its window onto the extended display, and choose **Fullscreen** in the stage window. If Safari opens the stage as a tab, choose **Window → Move Tab to New Window** first. Presenter can still confirm the stage window is responding, while its physical display placement remains unverified.

Wait for **Offline ready** on the first visit before disconnecting from the internet. The production build caches the console and stage window locally. The session queue and the current event are also stored in your browser on this device. **End Event** clears the live output and timer while keeping the queue and presets.

Use **Save Queue** to keep a named lineup and **Load Queue** to reuse it. Saved lineups are stored in this browser and work offline. Loading replaces the planned queue while the live timer and stage output continue.

Use **Image → Import Images** to keep PNG, JPEG, and WebP graphics available offline in this browser. **Send Image to Stage** shows the image without stopping an active countdown. **Fit** shows the whole graphic by default. **Fill Screen** crops the image to cover the display. Changing the fit of a live image takes effect immediately. Switch the stage output before deleting its live image.

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

1. Visit [https://aeon-timer-v2.netlify.app/](https://aeon-timer-v2.netlify.app/) in your web browser.
2. Set the countdown timer by specifying the target date and time of your event.
3. Optionally, add a personalized message to accompany the countdown.
4. Enable the auto-countdown feature by specifying the durations for different aspects of your event, if applicable.
5. Sit back and let Aeon Timer keep track of your countdown or scheduled durations automatically.

## Technologies Used

- **Next.js 16**: A React framework for building server-side rendered applications.
- **Tailwind CSS**: A utility-first CSS framework for quickly styling web applications.
- **Netlify**: Hosting platform used to deploy the Aeon Timer application.
- **TypeScript**: A typed superset of JavaScript that compiles to plain JavaScript.

## Local Development

Use Node.js 22 or later. Run `npm ci` to install the locked dependencies, then `npm run dev` to start the app.

## Contributing

Contributions are welcome! If you have any suggestions, feature requests, or bug reports, please feel free to open an issue or submit a pull request on the GitHub repository.

## License

This project is licensed under the [MIT License](LICENSE).
