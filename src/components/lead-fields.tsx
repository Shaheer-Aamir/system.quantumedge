import { inputClass } from "./form-styles";

export function LeadFields() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <label htmlFor="company" className="text-sm font-medium">Company</label>
        <input id="company" name="company" autoComplete="off" className={inputClass} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="contactName" className="text-sm font-medium">Contact name</label>
        <input id="contactName" name="contactName" autoComplete="off" className={inputClass} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="phone" className="text-sm font-medium">Phone number</label>
        <input id="phone" name="phone" type="tel" required autoComplete="off" placeholder="+1 415 555 0123" className={inputClass} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">Email <span className="font-normal text-muted">(optional)</span></label>
        <input id="email" name="email" type="email" autoComplete="off" className={inputClass} />
      </div>
    </div>
  );
}
