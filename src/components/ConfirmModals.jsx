import OptionModal from './OptionModal';

export function DeleteConfirmModal({ onDeleteWithChildren, onDeleteKeepChildren, onCancel }) {
  return (
    <OptionModal
      title="Delete node with children?"
      options={[
        { label: 'Delete with children', action: onDeleteWithChildren },
        { label: 'Keep children, delete node', action: onDeleteKeepChildren },
        { label: 'Cancel', action: onCancel },
      ]}
    />
  );
}

export function ClearCheckedModal({ onConfirm, onCancel }) {
  return (
    <OptionModal
      title="Delete all checked items in this column?"
      options={[
        { label: 'Delete checked', action: onConfirm },
        { label: 'Cancel', action: onCancel },
      ]}
    />
  );
}
