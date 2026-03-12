import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

const FEED_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/calendar-feed`;

export default function CalendarFeedModal({ userId, onClose }) {
  const [feedUrl, setFeedUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    async function loadOrCreateFeed() {
      setLoading(true);
      // Check for existing feed
      // Check for existing feed
      const { data: existing, error: fetchErr } = await supabase
        .from('calendar_feeds')
        .select('token')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (!fetchErr && existing) {
        setFeedUrl(`${FEED_BASE_URL}?token=${existing.token}`);
        setLoading(false);
        return;
      }

      // Create new feed (upsert to handle race conditions)
      const { data: created, error: createErr } = await supabase
        .from('calendar_feeds')
        .upsert({ user_id: userId }, { onConflict: 'user_id' })
        .select('token')
        .single();

      if (createErr) {
        console.error('[CalendarFeed] Error:', createErr);
        setLoading(false);
        return;
      }

      setFeedUrl(`${FEED_BASE_URL}?token=${created.token}`);
      setLoading(false);
    }

    loadOrCreateFeed();
  }, [userId]);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function handleCopy() {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Fallback: select the input
      if (inputRef.current) {
        inputRef.current.select();
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ maxWidth: 480 }}>
        <div className="modal-title">Calendar Feed</div>
        {loading ? (
          <p style={{ color: '#ccc', fontSize: 13 }}>Loading...</p>
        ) : feedUrl ? (
          <>
            <p style={{ color: '#ccc', margin: '0 0 8px', fontSize: 13 }}>
              Subscribe to this URL in your calendar app to see your Treenote deadlines.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                ref={inputRef}
                type="text"
                readOnly
                value={feedUrl}
                onClick={(e) => e.target.select()}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  fontSize: 12,
                  background: '#1a1a2e',
                  border: '1px solid #333',
                  color: '#eee',
                  borderRadius: 4,
                  fontFamily: 'monospace',
                }}
              />
              <button
                onClick={handleCopy}
                style={{
                  padding: '6px 14px',
                  background: copied ? '#2ecc71' : '#e94560',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 12,
                  whiteSpace: 'nowrap',
                }}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div style={{ color: '#888', fontSize: 12, lineHeight: 1.5 }}>
              <strong>Google Calendar:</strong> Other calendars (+) &rarr; From URL &rarr; paste the link<br />
              <strong>Apple Calendar:</strong> File &rarr; New Calendar Subscription &rarr; paste the link
            </div>
          </>
        ) : (
          <p style={{ color: '#e94560', fontSize: 13 }}>Failed to create feed. Please try again.</p>
        )}
        <div className="modal-option" onClick={onClose} style={{ marginTop: 12 }}>
          <kbd>Esc</kbd> <span>Close</span>
        </div>
      </div>
    </div>
  );
}
