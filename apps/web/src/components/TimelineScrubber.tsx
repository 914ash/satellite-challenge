type Props = {
  liveMode: boolean;
  minutesAgo: number;
  onLiveModeChange: (live: boolean) => void;
  onMinutesAgoChange: (value: number) => void;
};

export function TimelineScrubber({
  liveMode,
  minutesAgo,
  onLiveModeChange,
  onMinutesAgoChange
}: Props) {
  return (
    <div className="timeline-panel">
      <button
        type="button"
        className={liveMode ? "mode-button active" : "mode-button"}
        onClick={() => onLiveModeChange(true)}
      >
        Live
      </button>
      <button
        type="button"
        className={!liveMode ? "mode-button active" : "mode-button"}
        onClick={() => onLiveModeChange(false)}
      >
        Replay
      </button>

      <label htmlFor="minutesAgo">
        Scrub: {minutesAgo} min ago
        <input
          id="minutesAgo"
          type="range"
          min={0}
          max={60}
          value={minutesAgo}
          onChange={(event) => onMinutesAgoChange(Number(event.target.value))}
          disabled={liveMode}
        />
      </label>
    </div>
  );
}
