type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function fieldLabel(control: FormControl) {
  const label = control.closest("label");
  return label?.querySelector(":scope > span")?.textContent?.trim()
    || control.getAttribute("aria-label")
    || control.name
    || "这个字段";
}

function validationMessage(control: FormControl) {
  const label = fieldLabel(control);
  if (control.validity.valueMissing || (control.required && !control.value.trim())) {
    return `请先填写“${label}”，再继续。`;
  }
  if (control.validity.typeMismatch && control instanceof HTMLInputElement && control.type === "email") {
    return "邮箱格式不太对，请输入类似 name@example.com 的地址。";
  }
  if (control.validity.typeMismatch && control instanceof HTMLInputElement && control.type === "url") {
    return `“${label}”需要填写完整链接，例如 https://example.com。`;
  }
  if (control.validity.tooShort && control instanceof HTMLInputElement) {
    return `“${label}”至少需要 ${control.minLength} 个字符。`;
  }
  if (control.validity.rangeUnderflow || control.validity.rangeOverflow) {
    return `请检查“${label}”的数值范围。`;
  }
  return `请检查“${label}”的填写格式。`;
}

export function validateForm(form: HTMLFormElement) {
  form.querySelectorAll<HTMLElement>("[data-invalid='true']").forEach((element) => {
    element.removeAttribute("data-invalid");
    element.removeAttribute("data-error");
  });
  form.querySelectorAll<FormControl>("[aria-invalid='true']").forEach((control) => control.removeAttribute("aria-invalid"));

  const controls = Array.from(form.elements).filter((element): element is FormControl =>
    element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement,
  );
  const invalid = controls.find((control) => !control.disabled && (
    !control.checkValidity() || (control.required && !control.value.trim())
  ));
  if (!invalid) return null;

  const message = validationMessage(invalid);
  const field = invalid.closest(".form-field") as HTMLElement | null;
  invalid.setAttribute("aria-invalid", "true");
  field?.setAttribute("data-invalid", "true");
  field?.setAttribute("data-error", message);
  invalid.addEventListener("input", () => {
    invalid.removeAttribute("aria-invalid");
    field?.removeAttribute("data-invalid");
    field?.removeAttribute("data-error");
  }, { once: true });
  requestAnimationFrame(() => invalid.focus());
  return message;
}
