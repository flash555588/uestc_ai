/** A non-interactive decorative divider; it is deliberately not an entry button. */
export const FOOTER_DIVIDER_CODE = "-....--..-...- -....--..-...- -....--..-..-- -....--..-..-- -....--..-.... -....--..-..-. -....--..-.... -....--..-..-. -... .-";
const groups = FOOTER_DIVIDER_CODE.split(" ");

export function FooterCodeDivider() {
  return <div className="footer-code-rule" aria-hidden="true">{groups.map((group, index) => <span key={index}>{group}{index < groups.length - 1 ? " " : ""}</span>)}</div>;
}
