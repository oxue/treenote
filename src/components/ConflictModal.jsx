import OptionModal from './OptionModal';

export default function ConflictModal({ onKeepMine, onKeepTheirs, onKeepBoth }) {
  return (
    <OptionModal
      title="Conflict Detected"
      description="Your notes were updated from another window or device."
      options={[
        { label: 'Keep mine (overwrite server)', action: onKeepMine },
        { label: 'Keep theirs (reload from server)', action: onKeepTheirs },
        { label: 'Keep both (save mine as backup, load theirs)', action: onKeepBoth },
      ]}
    />
  );
}
