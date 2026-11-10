export const getFormattedTime = (milliseconds: number): string => {
  const padZero = (value: number): string =>
    value < 10 ? `0${value}` : `${value}`;

  const totalSeconds = Math.ceil(milliseconds / 1000);
  const seconds = padZero(totalSeconds % 60);
  const minutes = padZero(Math.floor(totalSeconds / 60) % 60);
  const hours = padZero(Math.floor(totalSeconds / 3600));

  if (hours === "00" && minutes === "00") {
    return `:${seconds}`;
  }

  if (hours === "00") {
    return `${minutes}:${seconds}`;
  }

  return `${hours}:${minutes}:${seconds}`;
};

export const getCurrentTime = (twentyFourHoursFormat: boolean) => {
  return new Date().toLocaleTimeString("en-US", {
    hour12: !twentyFourHoursFormat,
  });
};

interface GetMilliseconds {
  hours: number;
  minutes: number;
  seconds: number;
}

export const getMilliseconds = ({
  hours,
  minutes,
  seconds,
}: GetMilliseconds): number =>
  hours * 60 * 60 * 1000 + minutes * 60 * 1000 + seconds * 1000;
