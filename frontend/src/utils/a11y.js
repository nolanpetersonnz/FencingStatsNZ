// Keyboard-operable click-target props for elements that can't be real
// <button>s without breaking layout (table rows, absolutely-positioned
// bracket boxes). Enter and Space both activate, matching native buttons.
// Inline text that navigates should be a real <button className="fl-link">
// instead; this helper is the fallback for structural elements.
export function pressable(onClick) {
  return {
    role: 'button',
    tabIndex: 0,
    onClick,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick(e);
      }
    },
  };
}
