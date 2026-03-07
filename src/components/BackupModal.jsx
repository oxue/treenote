import { useState, useEffect } from 'react';
import { loadBackups, restoreBackup } from '../storage';
import './BackupModal.css';

export default function BackupModal({ userId, onClose, onRestore }) {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBackups(userId, 20)
      .then(setBackups)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  function handleRestore(backupId) {
    restoreBackup(userId, backupId).then((treeData) => {
      onRestore(treeData);
      onClose();
    }).catch(() => {});
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal backup-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">Backups</div>
        {loading ? (
          <div className="backup-loading">Loading...</div>
        ) : backups.length === 0 ? (
          <div className="backup-empty">No backups yet</div>
        ) : (
          <div className="backup-list">
            {backups.map((b) => (
              <div key={b.id} className="backup-row">
                <span className="backup-date">{formatDate(b.created_at)}</span>
                <button className="load-btn backup-restore-btn" onClick={() => handleRestore(b.id)}>
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="backup-actions">
          <button className="load-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
