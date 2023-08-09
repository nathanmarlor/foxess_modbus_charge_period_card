import {
  LitElement,
  html,
  css,
  unsafeCSS,
} from 'lit';

// Get access to ha-time-input
(await window.loadCardHelpers()).createRowElement({ type: 'input-datetime-entity' });

class FoxESSModbusChargePeriodCard extends LitElement {
  static UnableToConnectError = class extends Error {
    constructor() {
      super('Unable to connect');
    }

    get message() {
      return html`Unable to connect to integration. Please ensure <a href="https://github.com/nathanmarlor/foxess_modbus">foxess_modbus</a> is installed and configured.`;
    }
  };

  #hass = null;

  #entityIds = null;

  #loadedChargePeriods = [];

  #inverterId = null;

  #lastLocale = null;

  static get properties() {
    return {
      hass: {},
      _loadError: {
        state: true,
      },
      _friendlyName: {
        state: true,
        type: String,
      },
      _userChargePeriods: {
        state: true,
        type: Array,
      },
      _useAmPm: {
        state: true,
        type: Boolean,
      },
      _validationPassed: {
        state: true,
        type: Boolean,
      },
      _hasUnsavedChanges: {
        state: true,
        type: Boolean,
      },
      config: {},
    };
  }

  constructor() {
    super();

    this._loadError = null;
    this._friendlyName = null;
    this._userChargePeriods = null;
    this._useAmPm = true;
    this._validationPassed = false;
    this._hasUnsavedChanges = false;
  }

  get hass() {
    return this.#hass;
  }

  set hass(hass) {
    this.#hass = hass;
    if (hass != null && hass.locale !== this.#lastLocale) {
      this.#lastLocale = hass.locale;
      this._useAmPm = this.#useAmPm(hass.locale);
    }
    this.#onInputsChanged();
  }

  async setConfig(config) {
    this.#inverterId = config.inverter || '';
    this.#entityIds = null;
    await this.#onInputsChanged();
  }

  async #onInputsChanged() {
    // If we haven't had hass / the config yet, wait until we get it
    if (this.#hass != null && this.#inverterId != null) {
      const oldLoadedChargePeriods = this.#loadedChargePeriods;
      await this.#loadChargePeriods();
      this.#updateUserChargePeriods(oldLoadedChargePeriods);
    }
  }

  static getConfigElement() {
    return document.createElement('foxess-modbus-charge-period-card-editor');
  }

  static getStubConfig() {
    return { inverter: '' };
  }

  getCardSize() {
    return 10;// We're about 500px high, each unit is 50px
  }

  async #loadEntityIds() {
    if (this.#entityIds == null) {
      try {
        const result = await this.#hass.callWS({
          type: 'foxess_modbus/get_charge_periods',
          inverter: this.#inverterId,
        });
        this.#entityIds = result.charge_periods.map((period) => ({
          periodStartEntityId: period.period_start_entity_id,
          periodEndEntityId: period.period_end_entity_id,
          enableForceChargeEntityId: period.enable_force_charge_entity_id,
          enableChargeFromGridEntityId: period.enable_charge_from_grid_entity_id,
        }));
        this._friendlyName = result.friendly_name;
      } catch (error) {
        this.#entityIds = null;
        console.log(error);
        if (error.code === 'unknown_command') {
          throw FoxESSModbusChargePeriodCard.UnableToConnectError();
        } else {
          throw error;
        }
      }
    }
  }

  async #loadChargePeriods() {
    try {
      if (this.#hass == null || !this.#hass.connected) {
        this.#loadedChargePeriods = null;
        return;
      }

      if (this.#entityIds == null) {
        await this.#loadEntityIds();
      } else {
        // If we can't find any of the entity IDs, they might have changed. Re-fetch
        for (const chargePeriod of this.#entityIds) {
          if (!(chargePeriod.periodStartEntityId in this.#hass.states)
            || !(chargePeriod.periodEndEntityId in this.#hass.states)
            || !(chargePeriod.enableForceChargeEntityId in this.#hass.states)
            || !(chargePeriod.enableChargeFromGridEntityId in this.#hass.states)) {
            await this.#loadEntityIds(); // eslint-disable-line no-await-in-loop
            break;
          }
        }
      }

      if (this.#entityIds == null) {
        this.#loadedChargePeriods = null;
        return;
      }

      const nullEntityIds = [];
      const checkNullId = (x) => {
        if (this.#hass.states[x] == null) {
          nullEntityIds.push(x);
        }
      };
      for (const chargePeriod of this.#entityIds) {
        checkNullId(chargePeriod.periodStartEntityId);
        checkNullId(chargePeriod.periodEndEntityId);
        checkNullId(chargePeriod.enableForceChargeEntityId);
        checkNullId(chargePeriod.enableChargeFromGridEntityId);
      }
      if (nullEntityIds.length > 0) {
        throw Error(`Unable to load the following entities: ${nullEntityIds.join(', ')}. Make sure they are enabled.`);
      }

      const chargePeriods = [];
      for (const chargePeriod of this.#entityIds) {
        chargePeriods.push({
          start: this.#hass.states[chargePeriod.periodStartEntityId].state,
          end: this.#hass.states[chargePeriod.periodEndEntityId].state,
          enableForceCharge: this.#hass.states[chargePeriod.enableForceChargeEntityId].state === 'on',
          enableChargeFromGrid: this.#hass.states[chargePeriod.enableChargeFromGridEntityId]?.state === 'on',
        });
      }

      this._loadError = null;
      this.#loadedChargePeriods = chargePeriods;
    } catch (error) {
      this._loadError = error.message;
      this.#loadedChargePeriods = null;
    }
  }

  #updateUserChargePeriods(oldLoadedChargePeriods) {
    if (this.#loadedChargePeriods == null) {
      this._userChargePeriods = null;
      return;
    }

    const isUnknown = (val) => val === 'unknown' || val === 'unavailable';

    let anyUnknown = false;
    for (const chargePeriod of this.#loadedChargePeriods) {
      if (isUnknown(chargePeriod.start) || isUnknown(chargePeriod.end)
        || isUnknown(chargePeriod.enableChargeFromGrid) || isUnknown(chargePeriod.enableChargeFromGrid)) {
        anyUnknown = true;
        break;
      }
    }

    if (anyUnknown) {
      this._userChargePeriods = null;
      return;
    }

    const newUserChargePeriods = [];
    let isSameAsPrevious = true;

    for (let i = 0; i < this.#loadedChargePeriods.length; i++) {
      const loadedPeriod = this.#loadedChargePeriods[i];
      // If the user hasn't modified this charge period, update it
      if (this._userChargePeriods == null
        || i >= this._userChargePeriods.length
        || oldLoadedChargePeriods == null
        || i >= oldLoadedChargePeriods.length
        || (oldLoadedChargePeriods[i].start === this._userChargePeriods[i].start
          && oldLoadedChargePeriods[i].end === this._userChargePeriods[i].end
          && oldLoadedChargePeriods[i].enableForceCharge === this._userChargePeriods[i].enableForceCharge
          && oldLoadedChargePeriods[i].enableChargeFromGrid === this._userChargePeriods[i].enableChargeFromGrid)
      ) {
        newUserChargePeriods.push({
          start: loadedPeriod.start,
          end: loadedPeriod.end,
          enableForceCharge: loadedPeriod.enableForceCharge,
          enableChargeFromGrid: loadedPeriod.enableChargeFromGrid,
        });
        isSameAsPrevious = false;
      } else {
        newUserChargePeriods.push(this._userChargePeriods[i]);
      }
    }

    if (!isSameAsPrevious) {
      this._userChargePeriods = newUserChargePeriods;
      this.#updateValidation();
    }
  }

  #updateValidation() {
    if (this._userChargePeriods == null) {
      this._validationPassed = false;
      this._hasUnsavedChanges = false;
      return;
    }

    let anyDiffer = false;

    for (let i = 0; i < this._userChargePeriods.length; i++) {
      const chargePeriod = this._userChargePeriods[i];

      chargePeriod.validationMessage = null;

      if (chargePeriod.enableForceCharge) {
        const startDate = new Date(`1970-01-01T${chargePeriod.start}Z`);
        const endDate = new Date(`1970-01-01T${chargePeriod.end}Z`);
        if (endDate <= startDate) {
          chargePeriod.validationMessage = 'End time must be after start time';
        } else {
          for (let j = 0; j < i; j++) {
            const otherPeriod = this._userChargePeriods[j];
            if (otherPeriod.enableForceCharge) {
              const otherStart = new Date(`1970-01-01T${otherPeriod.start}Z`);
              const otherEnd = new Date(`1970-01-01T${otherPeriod.end}Z`);
              if (otherStart < endDate && startDate < otherEnd) {
                chargePeriod.validationMessage = 'Charge period must not overlap other period '
                  + `${otherPeriod.start}-${otherPeriod.end}`;
              }
            }
          }
        }
      }

      const loadedChargePeriod = this.#loadedChargePeriods[i];
      if (loadedChargePeriod.start !== chargePeriod.start
        || loadedChargePeriod.end !== chargePeriod.end
        || loadedChargePeriod.enableForceCharge !== chargePeriod.enableForceCharge
        || loadedChargePeriod.enableChargeFromGrid !== chargePeriod.enableChargeFromGrid) {
        anyDiffer = true;
      }
    }

    let anyFailed = false;
    for (const chargePeriod of this._userChargePeriods) {
      if (chargePeriod.validationMessage != null) {
        anyFailed = true;
        break;
      }
    }

    this._validationPassed = !anyFailed;
    this._hasUnsavedChanges = anyDiffer;
  }

  // eslint-disable-next-line no-unused-vars
  #useAmPm(locale) {
    // The drop-down for the AM/PM selector doesn't work properly: not sure why
    // As a workaround, force 24-hour time
    return false;
    // // Adapted from https://github.com/home-assistant/frontend/blob/9b3710f8bdf7c5c63dc2089b6f95b5237656af3b/src/common/datetime/use_am_pm.ts
    // if (locale.time_format === 'language' || locale.time_format === 'system') {
    //   const testLanguage = locale.time_format === 'language' ? locale.language : undefined;
    //   const test = new Date('January 1, 2023 22:00:00').toLocaleString(testLanguage);
    //   return test.includes('10');
    // }
    // return locale.time_format === '12';
  }

  #inputChanged() {
    this.#updateValidation();
    this.requestUpdate();
  }

  async #handleSave() {
    if (this.#hass == null) {
      return;
    }

    const data = [];
    for (const chargePeriod of this._userChargePeriods) {
      const period = {
        enable_force_charge: chargePeriod.enableForceCharge,
        enable_charge_from_grid: chargePeriod.enableChargeFromGrid,
      };
      if (chargePeriod.enableForceCharge) {
        period.start = chargePeriod.start;
        period.end = chargePeriod.end;
      }
      data.push(period);
    }

    try {
      await this.#hass.callService('foxess_modbus', 'update_all_charge_periods', {
        inverter: this.#inverterId,
        charge_periods: data,
      });
    } catch (error) {
      console.log(error);
      throw error;
    }
  }

  #handleReset() {
    this._userChargePeriods = null;
    this.#updateUserChargePeriods();
  }

  #renderChargePeriods() {
    return html`
      ${this._userChargePeriods.map((x, index) => this.#renderChargePeriod(index, x))}

      <div class="button-row">
        <mwc-button
          label="Reset"
          ?disabled=${!this._hasUnsavedChanges}
          @click=${this.#handleReset}></mwc-button>
        <mwc-button
          label="Save"
          ?disabled=${!(this._validationPassed && this._hasUnsavedChanges)}
          @click=${this.#handleSave}></mwc-button>
      </div>
    `;
  }

  #renderChargePeriod(index, chargePeriod) {
    // Make sure this is in sync with _useAmPm
    const locale = { time_format: this._useAmPm ? '12' : '24' };
    const validationMessage = chargePeriod.validationMessage == null
      ? null
      : html`<p class="error-message">${chargePeriod.validationMessage}</p>`;
    return html`
      <fieldset class="${this._useAmPm ? 'time-has-am-pm' : 'time-has-no-am-pm'}">
        <legend>Charge Period&nbsp;${index + 1}</legend>
        <div class="toggle-row">
          <p>Enable charge period:</p>
          <ha-switch
            ?checked=${chargePeriod.enableForceCharge}
            @change=${(e) => { chargePeriod.enableForceCharge = e.target.checked; this.#inputChanged(); }}></ha-switch>
        </div>
        <div class="toggle-row">
          <p>Enable charge from grid:</p>
          <ha-switch
            ?checked=${chargePeriod.enableChargeFromGrid}
            ?disabled=${!chargePeriod.enableForceCharge}
            @change=${(e) => { chargePeriod.enableChargeFromGrid = e.target.checked; this.#inputChanged(); }}></ha-switch>
        </div>
        <div class="range-row">
          <span class="time-label">Start:</span>
          <ha-time-input
            .value=${chargePeriod.start}
            .locale=${locale}
            ?disabled=${!chargePeriod.enableForceCharge}
            @value-changed=${(e) => { chargePeriod.start = e.target.value; this.#inputChanged(); }}></ha-time-input>
          <div class="time-separator"></div>
          <span class="time-label">End:</span>
          <ha-time-input
            .value=${chargePeriod.end}
            .locale=${locale}
            ?disabled=${!chargePeriod.enableForceCharge}
            @value-changed=${(e) => { chargePeriod.end = e.target.value; this.#inputChanged(); }}></ha-time-input>
        </div>
        ${validationMessage}
      </fieldset>
    `;
  }

  #renderError() {
    if (this._loadError != null) {
      console.log(this._loadError);
      return html`<p class="error-message">${this._loadError}</p>`;
    }

    const message = (this.#hass != null && !this.#hass.connected) ? 'Connecting...' : 'Loading...';
    return html`<div class="loader"><div class="spinner"></div><p>${message}</p></div>`;
    // return html`<p class="error-message">Unable to load charge periods. Is foxess-modbus installed and configured?</p>`;
  }

  render() {
    const content = this._userChargePeriods == null
      ? this.#renderError()
      : this.#renderChargePeriods();
    const friendlyName = this._friendlyName
      ? ` (${this._friendlyName})`
      : '';
    return html`
      <ha-card header="Charge Periods${friendlyName}">
        <div class="card-content">
          ${content}
        </div>
      </ha-card>
    `;
  }

  static get styles() {
    function narrowStyle(cls) {
      return css`
      .${unsafeCSS(cls)} .range-row {
        display: grid;
        grid-template-columns: auto auto;
        column-gap: 8px;
      }
      .${unsafeCSS(cls)} .range-row .time-label {
        display: block;
      }
      .${unsafeCSS(cls)} .range-row .time-separator {
        display: none;
      }
      `;
    }
    return css`
      foxess-modbus-charge-period-card {
        padding: 16px;
        display: block;
        font-size: 18px;
      }
      fieldset {
        margin: 8px 8px 16px 8px;
        padding: 0 8px;
        min-width: 0;
        border: 1px solid lightgray;
        border-radius: 4px;
        container-type: inline-size;
      }
      legend {
        padding: 2px 5px;
      }
      .toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 3px;
      }
      .toggle-row p {
        margin: 8px 0;
      }
      .range-row {
        display: flex;
        margin: 8px;
        align-items: center;
        justify-content: center;
        row-gap: 5px;
      }
      .range-row .time-label {
        display: none;
      }
      .range-row .time-separator {
        height: 1px;
        width: 30px;
        background-color: #ededf0;
        margin: 0 10px;
      }
      @container (max-width: 375px) {
        ${narrowStyle('time-has-am-pm')}
      }
      @container (max-width: 210px) {
        ${narrowStyle('time-has-no-am-pm')}
      }
      .error-message {
        color: var(--error-color);
      }
      .button-row {
        display: flex;
        justify-content: flex-end;
      }
      .loader {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .spinner {
        display: inline-block;
        border: 3px solid #f3f3f3; /* Light grey */
        border-top: 3px solid var(--primary-color);
        border-radius: 50%;
        width: 15px;
        height: 15px;
        animation: spin 2s linear infinite;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
  }
}
customElements.define('foxess-modbus-charge-period-card', FoxESSModbusChargePeriodCard);

class FoxESSModbusChargePeriodCardEditor extends LitElement {
  #hass = null;

  #schema = [{
    name: 'inverter',
    selector: {
      device: {
        integration: 'foxess_modbus',
        entity:
        {
          domain: 'binary_sensor',
          device_class: 'power',
        },
      },
    },
  }];

  get hass() {
    return this.#hass;
  }

  set hass(hass) {
    this.#hass = hass;
  }

  setConfig(config) {
    this._config = config;
  }

  #valueChanged(evt) {
    const event = new Event('config-changed', {
      bubbles: true,
      composed: true,
    });
    event.detail = { config: evt.detail.value };
    this.dispatchEvent(event);
  }

  #computeLabel() {
    return 'Inverter';
  }

  render() {
    return html`
      <ha-form
        .hass="${this.#hass}"
        .schema="${this.#schema}"
        .data="${this._config}"
        .computeLabel="${this.#computeLabel}"
        @value-changed="${this.#valueChanged}"></ha-form>
    `;
  }
}
customElements.define('foxess-modbus-charge-period-card-editor', FoxESSModbusChargePeriodCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'foxess-modbus-charge-period-card',
  name: 'FoxESS - Modbus: Charge Period Card',
  preview: true, // Optional - defaults to false
  description: 'Set charge periods on your FoxESS inverter',
});
