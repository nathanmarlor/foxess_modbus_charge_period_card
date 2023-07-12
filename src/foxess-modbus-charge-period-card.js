import {
  LitElement,
  html,
  css,
} from 'https://unpkg.com/lit-element@2.0.1/lit-element.js?module';

// Get access to ha-time-input
(await window.loadCardHelpers()).createRowElement({ type: 'input-datetime-entity' });

class FoxESSModbusChargePeriodCard extends LitElement {
  #hass = null;

  #entityIds = null;

  #loadedChargePeriods = [];

  #inverterId = '';

  static get properties() {
    return {
      hass: {},
      _loadError: {
        state: true,
      },
      _userChargePeriods: {
        state: true,
        type: Array,
      },
      _validationMessage: {
        state: true,
        type: String,
      },
      config: {},
    };
  }

  constructor() {
    super();

    this._loadError = null;
    this._userChargePeriods = null;
    this._validationMessage = null;
  }

  get hass() {
    return this.#hass;
  }

  set hass(hass) {
    this.#hass = hass;
    this.#onHassChanged();
  }

  async setConfig(config) {
    this.config = config;
  }

  async #onHassChanged() {
    const oldLoadedChargePeriods = this.#loadedChargePeriods;
    await this.#loadChargePeriods();
    this.#updateUserChargePeriods(oldLoadedChargePeriods);
  }

  async #loadEntityIds() {
    if (this.#entityIds == null) {
      this._loadError = null;
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
      } catch (error) {
        this.#entityIds = null;
        if (error.code === 'unknown_error') {
          this._loadError = error.message;
        }
        console.log(error);
      }
    }
  }

  async #loadChargePeriods() {
    if (this.#hass == null) {
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
    const chargePeriods = [];
    for (const chargePeriod of this.#entityIds) {
      chargePeriods.push({
        start: this.#hass.states[chargePeriod.periodStartEntityId].state,
        end: this.#hass.states[chargePeriod.periodEndEntityId].state,
        enableForceCharge: this.#hass.states[chargePeriod.enableForceChargeEntityId].state === 'on',
        enableChargeFromGrid: this.#hass.states[chargePeriod.enableChargeFromGridEntityId].state === 'on',
      });
    }

    this.#loadedChargePeriods = chargePeriods;
  }

  #updateUserChargePeriods(oldLoadedChargePeriods) {
    if (this.#loadedChargePeriods == null) {
      this._userChargePeriods = null;
      return;
    }

    const newUserChargePeriods = [];

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
        console.log(`Pushing charge period ${i}`);
        newUserChargePeriods.push({
          start: loadedPeriod.start,
          end: loadedPeriod.end,
          enableForceCharge: loadedPeriod.enableForceCharge,
          enableChargeFromGrid: loadedPeriod.enableChargeFromGrid,
        });
      } else {
        console.log(`Retaining charge period ${i}`);
        newUserChargePeriods.push(this._userChargePeriods[i]);
      }
    }

    this._userChargePeriods = newUserChargePeriods;
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
      this._validationMessage = error.message;
    }
  }

  #handleReset() {
    this._userChargePeriods = null;
    this.#updateUserChargePeriods();
  }

  #renderChargePeriods() {
    return html`
      ${this._userChargePeriods.map((x) => this.#renderChargePeriod(x))}

      <p>${this._validationMessage}</p>

      <div class="button-row">
        <mwc-button
          label="Reset"
          @click=${this.#handleReset}></mwc-button>
        <mwc-button
          label="Save"
          ?disabled=${this._validationMessage != null}
          @click=${this.#handleSave}></mwc-button>
      </div>
    `;
  }

  #renderChargePeriod(chargePeriod) {
    return html`
      <div class="toggle-row">
        <p>Enable force charge:</p>
        <ha-switch
          ?checked=${chargePeriod.enableForceCharge}
          @change=${(e) => { chargePeriod.enableForceCharge = e.target.checked; this.#inputChanged(); }}></ha-switch>
      </div>
      <div class="toggle-row">
        <p>Enable charge from grid:</p>
        <ha-switch
          ?checked=${chargePeriod.enableChargeFromGrid}
          @change=${(e) => { chargePeriod.enableChargeFromGrid = e.target.checked; this.#inputChanged(); }}></ha-switch>
      </div>
      <div class="range-row">
        <ha-time-input
          .value=${chargePeriod.start}
          .locale=${this.hass.locale}
          ?disabled=${!chargePeriod.enableForceCharge}
          @value-changed=${(e) => { chargePeriod.start = e.target.value; this.#inputChanged(); }}></ha-time-input>
        <div class="time-separator"></div>
        <ha-time-input
          .value=${chargePeriod.end}
          .locale=${this.hass.locale}
          ?disabled=${!chargePeriod.enableForceCharge}
          @value-changed=${(e) => { chargePeriod.end = e.target.value; this.#inputChanged(); }}></ha-time-input>
      </div>
    `;
  }

  #renderError() {
    if (this._loadError != null) {
      return html`<p>${this._loadError}</p>`;
    }

    return html`<p>Unable to load charge periods. Is foxess-modbus installed and configured?</p>`;
  }

  render() {
    const content = this._userChargePeriods == null
      ? this.#renderError()
      : this.#renderChargePeriods();
    return html`
      <ha-card header="Charge Windows">
        <div class="card-content">
          ${content}
        </div>
      </ha-card>
    `;
  }

  #inputChanged() {
    // console.log(this._chargePeriods);
    this.requestUpdate();

    // if (this._chargePeriods[0].enableForceCharge) {
    //   this._validationMessage = 'Test...';
    // } else {
    //   this._validationMessage = null;
    // }
  }

  static get styles() {
    return css`
      foxess-modbus-charge-period-card {
        background-color: white;
        padding: 16px;
        display: block;
        font-size: 18px;
      }
      .toggle-row {
        display: flex;
        align-items: center;
      }
      .toggle-row p {
        flex: 1 0 auto;
      }
      .range-row {
        display: flex;
        justify-content: center;
        align-items: center;
      }
      .time-separator {
        height: 1px;
        width: 30px;
        background-color: #ededf0;
        margin: 0 10px;
      }
      .button-row {
        margin-top: 20px;
        display: flex;
        justify-content: flex-end;
      }
    `;
  }
}

customElements.define('foxess-modbus-charge-period-card', FoxESSModbusChargePeriodCard);
