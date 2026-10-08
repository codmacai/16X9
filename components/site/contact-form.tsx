"use client";

import { useState, type FormEvent } from "react";
import { BUDGETS, PROJECT_TYPES, STUDIO, TIMELINES } from "./content";
import sx from "./sections.module.css";

// ===========================================================================
// PROJECT FORM — a short brief. For now it hands the brief to the visitor's
// email app, addressed to the studio; swap `send` for a form service or an API
// route (e.g. Resend) to send it from the site instead.
// ===========================================================================
export default function ContactForm() {
  const [sent, setSent] = useState(false);

  const send = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const types = f.getAll("type").join(", ") || "Not specified";
    const body = [
      `Name: ${f.get("name")}`,
      `Email: ${f.get("email")}`,
      `Company: ${f.get("company") || "-"}`,
      `Project: ${types}`,
      `Budget: ${f.get("budget") || "-"}`,
      `Timeline: ${f.get("timeline") || "-"}`,
      "",
      String(f.get("message") ?? ""),
    ].join("\n");
    const subject = `New project: ${f.get("company") || f.get("name")}`;
    window.location.href = `mailto:${STUDIO.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  if (sent) {
    return (
      <div className={sx.sent} role="status">
        <h2>Thank you.</h2>
        <p className={sx.lede}>
          Your email app should have opened with your brief, addressed to {STUDIO.email}. Send it and we&apos;ll reply within one working
          day.
        </p>
        <button type="button" className={`${sx.button} ${sx.buttonGhost}`} style={{ width: "fit-content" }} onClick={() => setSent(false)}>
          Edit the brief
        </button>
      </div>
    );
  }

  return (
    <form className={sx.form} onSubmit={send}>
      <div className={sx.fieldRow}>
        <div className={sx.field}>
          <label htmlFor="cf-name">Your name</label>
          <input id="cf-name" name="name" autoComplete="name" required placeholder="Jane Doe" />
        </div>
        <div className={sx.field}>
          <label htmlFor="cf-email">Email</label>
          <input id="cf-email" name="email" type="email" autoComplete="email" required placeholder="jane@brand.com" />
        </div>
      </div>
      <div className={sx.field}>
        <label htmlFor="cf-company">Company or brand</label>
        <input id="cf-company" name="company" autoComplete="organization" placeholder="Brand name" />
      </div>

      <fieldset className={sx.field}>
        <legend>What do you need?</legend>
        <div className={sx.chips}>
          {PROJECT_TYPES.map((t) => (
            <label key={t} className={sx.chip}>
              <input type="checkbox" name="type" value={t} />
              <span>{t}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className={sx.fieldRow}>
        <div className={sx.field}>
          <label htmlFor="cf-budget">Budget</label>
          <select id="cf-budget" name="budget" defaultValue="">
            <option value="" disabled>
              Choose a range
            </option>
            {BUDGETS.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className={sx.field}>
          <label htmlFor="cf-timeline">Timeline</label>
          <select id="cf-timeline" name="timeline" defaultValue="">
            <option value="" disabled>
              When do you need it?
            </option>
            {TIMELINES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={sx.field}>
        <label htmlFor="cf-message">Tell us about it</label>
        <textarea id="cf-message" name="message" required placeholder="The brand, the idea, the audience, the deadline…" />
      </div>

      <div className={sx.formFoot}>
        <button type="submit" className={sx.button}>
          Send the brief <span aria-hidden="true">↗</span>
        </button>
        <p className={sx.formNote}>We reply within one working day. Your details are only used to answer you.</p>
      </div>
    </form>
  );
}
