// Stand-in for @minecraft/server-ui: forms resolve with a scripted answer queue.

export const FormCancelationReason = { UserBusy: 'UserBusy', UserClosed: 'UserClosed' };

/** Answers consumed by the next forms shown (selection index or formValues array). */
export const answers = [];
export const shown = [];

class BaseForm {
  constructor(kind) {
    this.kind = kind;
    this.buttons = [];
    this.text = [];
  }
  title(t) {
    this.text.push(String(t));
    return this;
  }
  body(t) {
    this.text.push(String(t));
    return this;
  }
  label(t) {
    this.text.push(String(t));
    return this;
  }
  header(t) {
    this.text.push(String(t));
    return this;
  }
  divider() {
    return this;
  }
  async show(player) {
    shown.push({ kind: this.kind, text: this.text.join('\n'), buttons: this.buttons, player: player.name });
    const a = answers.shift();
    if (a === undefined) return { canceled: true, cancelationReason: FormCancelationReason.UserClosed };
    if (Array.isArray(a)) return { canceled: false, formValues: a };
    return { canceled: false, selection: a };
  }
}

export class ActionFormData extends BaseForm {
  constructor() {
    super('action');
  }
  button(text, icon) {
    if (icon !== undefined && typeof icon !== 'string') throw new Error('bad icon');
    this.buttons.push(String(text));
    return this;
  }
}

export class MessageFormData extends BaseForm {
  constructor() {
    super('message');
  }
  button1(t) {
    this.buttons[0] = String(t);
    return this;
  }
  button2(t) {
    this.buttons[1] = String(t);
    return this;
  }
}

export class ModalFormData extends BaseForm {
  constructor() {
    super('modal');
  }
  toggle(label, opts) {
    this.buttons.push(`toggle:${label}:${opts?.defaultValue}`);
    return this;
  }
  slider(label) {
    this.buttons.push(`slider:${label}`);
    return this;
  }
  dropdown(label) {
    this.buttons.push(`dropdown:${label}`);
    return this;
  }
  textField(label) {
    this.buttons.push(`text:${label}`);
    return this;
  }
  submitButton() {
    return this;
  }
}
