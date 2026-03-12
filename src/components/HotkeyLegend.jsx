import './HotkeyLegend.css';

export default function HotkeyLegend({ mode, focus }) {
  const isQueue = focus === 'queue';

  return (
    <div className="hotkey-legend">
      {mode === 'visual' ? (
        isQueue ? (
          <>
            <div className="legend-row">
              <span className="legend-keys arrow-keys">
                <kbd>&#9668;</kbd>
                <kbd>&#9658;</kbd>
              </span>
              <span className="legend-desc">Navigate queue</span>
            </div>
            <div className="legend-row">
              <span className="legend-keys arrow-keys">
                <kbd>&#8679;</kbd>
                <span className="legend-plus">+</span>
                <kbd>&#9668;</kbd>
                <kbd>&#9658;</kbd>
              </span>
              <span className="legend-desc">Reorder</span>
            </div>
            <div className="legend-row">
              <span className="legend-keys arrow-keys">
                <kbd>&#8984;</kbd>
                <span className="legend-plus">+</span>
                <kbd>&#9668;</kbd>
                <kbd>&#9658;</kbd>
              </span>
              <span className="legend-desc">Insert temp card</span>
            </div>
            <div className="legend-row">
              <kbd>&#9660;</kbd>
              <span className="legend-desc">Back to tree</span>
            </div>
            <div className="legend-row">
              <kbd>Enter</kbd>
              <span className="legend-desc">Edit item</span>
            </div>
            <div className="legend-row">
              <kbd>c</kbd>
              <span className="legend-desc">Check off</span>
            </div>
            <div className="legend-row">
              <kbd>x</kbd>
              <span className="legend-desc">Delete</span>
            </div>
            <div className="legend-row">
              <kbd>q</kbd>
              <span className="legend-desc">Jump to node</span>
            </div>
            <div className="legend-row">
              <kbd>d</kbd>
              <span className="legend-desc">Deadline / metadata</span>
            </div>
            <div className="legend-row">
              <kbd>m</kbd>
              <span className="legend-desc">Toggle markdown</span>
            </div>
            <div className="legend-row">
              <kbd>z</kbd>
              <span className="legend-desc">Undo</span>
            </div>
            <div className="legend-row">
              <kbd>l</kbd>
              <span className="legend-desc">Toggle legend</span>
            </div>
          </>
        ) : (
          <>
            <div className="legend-row">
              <span className="legend-keys arrow-keys">
                <kbd>&#9650;</kbd>
                <kbd>&#9668;</kbd>
                <kbd>&#9660;</kbd>
                <kbd>&#9658;</kbd>
              </span>
              <span className="legend-desc">Navigate</span>
            </div>
            <div className="legend-row">
              <span className="legend-keys arrow-keys">
                <kbd>&#8679;</kbd>
                <span className="legend-plus">+</span>
                <kbd>&#9650;</kbd>
                <kbd>&#9660;</kbd>
              </span>
              <span className="legend-desc">Swap node</span>
            </div>
            <div className="legend-row">
              <span className="legend-keys arrow-keys">
                <kbd>&#8984;</kbd>
                <span className="legend-plus">+</span>
                <kbd>&#9650;</kbd>
                <kbd>&#9668;</kbd>
                <kbd>&#9660;</kbd>
                <kbd>&#9658;</kbd>
              </span>
              <span className="legend-desc">Insert node</span>
            </div>
            <div className="legend-row">
              <kbd>Enter</kbd>
              <span className="legend-desc">Edit selected</span>
            </div>
            <div className="legend-row">
              <kbd>c</kbd>
              <span className="legend-desc">Check/uncheck</span>
            </div>
            <div className="legend-row">
              <kbd>x</kbd>
              <span className="legend-desc">Delete node</span>
            </div>
            <div className="legend-row">
              <kbd>z</kbd>
              <span className="legend-desc">Undo</span>
            </div>
            <div className="legend-row">
              <span className="legend-keys arrow-keys">
                <kbd>&#8679;</kbd>
                <span className="legend-plus">+</span>
                <kbd>Z</kbd>
              </span>
              <span className="legend-desc">Redo</span>
            </div>
            <div className="legend-row">
              <kbd>m</kbd>
              <span className="legend-desc">Toggle markdown</span>
            </div>
            <div className="legend-row">
              <kbd>q</kbd>
              <span className="legend-desc">Add to queue</span>
            </div>
            <div className="legend-row">
              <kbd>d</kbd>
              <span className="legend-desc">Deadline / metadata</span>
            </div>
            <div className="legend-row">
              <kbd>f</kbd>
              <span className="legend-desc">Calendar feed</span>
            </div>
            <div className="legend-row">
              <span className="legend-keys arrow-keys">
                <kbd>&#8984;</kbd>
                <span className="legend-plus">+</span>
                <kbd>X</kbd>
              </span>
              <span className="legend-desc">Clear checked</span>
            </div>
            <div className="legend-row">
              <span className="legend-keys arrow-keys">
                <kbd>&#8984;</kbd>
                <span className="legend-plus">+</span>
                <kbd>S</kbd>
              </span>
              <span className="legend-desc">Save</span>
            </div>
            <div className="legend-row">
              <kbd>l</kbd>
              <span className="legend-desc">Toggle legend</span>
            </div>
          </>
        )
      ) : (
        <>
          <div className="legend-row">
            <kbd>Esc</kbd>
            <span className="legend-desc">Confirm &amp; exit</span>
          </div>
          <div className="legend-row">
            <kbd>Enter</kbd>
            <span className="legend-desc">New line</span>
          </div>
        </>
      )}
    </div>
  );
}
