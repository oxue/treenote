export default function ChildCount({ children }) {
  if (children.length === 0) return null;
  const unchecked = children.filter(c => !c.checked).length;
  const checked = children.filter(c => c.checked).length;
  return (
    <span className="child-count">
      {unchecked}{checked > 0 && <>/<s>{checked}</s></>}
    </span>
  );
}
