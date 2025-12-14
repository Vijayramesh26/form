<template>
  <v-container class="pa-6">
    <v-card class="pa-4 mb-4">
      <v-row align="center">
        <v-col cols="12" md="6">
          <v-select
            v-model="selectedType"
            :items="types"
            item-value="type_key"
            item-title="label"
            label="Choose KYC Type"
            :rules="[requiredRule]"
            @change="onTypeSelected"
          />
        </v-col>

        <v-col cols="12" md="3" v-if="selectedTypeObj">
          <v-card outlined class="pa-3">
            <div><strong>Selected:</strong> {{ selectedTypeObj.label }}</div>
            <div><strong>Fee:</strong> {{ selectedTypeObj.fee_amount }}</div>
          </v-card>
        </v-col>

        <v-col cols="12" md="3" v-if="selectedType">
          <v-btn color="primary" @click="beginKyc" :disabled="loading"> Start KYC </v-btn>
        </v-col>
      </v-row>
    </v-card>

    <!-- Stepper shown only after beginKyc success -->
    <div v-if="stepOrder.length > 0">
      <v-stepper v-model="step">
        <v-stepper-header>
          <v-stepper-item
            v-for="(skey, idx) in stepOrder"
            :key="skey"
            :value="idx + 1"
            :complete="idx + 1 < step"
          >
            {{ stepLabels[skey] || formatLabel(skey) }}
          </v-stepper-item>
        </v-stepper-header>

        <v-stepper-items>
          <v-stepper-content v-for="(skey, idx) in stepOrder" :key="skey" :step="idx + 1">
            <v-form :ref="getFormRef(skey)">
              <v-card class="pa-4" outlined>
                <h3>{{ stepLabels[skey] || formatLabel(skey) }}</h3>

                <div v-for="field in fieldsByStep[skey] || []" :key="field.field_key" class="mb-3">
                  <DynamicField :field="field" v-model="formModel[field.field_key]" />
                </div>
              </v-card>
            </v-form>

            <v-row class="mt-4">
              <v-col>
                <v-btn text @click="prevStep" v-if="idx + 1 > 1">Back</v-btn>

                <v-btn color="primary" class="ml-2" @click="next(idx + 1, skey)">
                  {{ idx + 1 === stepOrder.length ? 'Proceed to Payment' : 'Next' }}
                </v-btn>
              </v-col>
            </v-row>
          </v-stepper-content>
        </v-stepper-items>
      </v-stepper>
    </div>

    <!-- Payment dialog (simple) -->
    <v-dialog v-model="showPayment" max-width="500">
      <v-card>
        <v-card-title>Pay Fee</v-card-title>
        <v-card-text>
          <div><strong>Type:</strong> {{ selectedTypeObj?.label }}</div>
          <div><strong>Amount:</strong> {{ selectedTypeObj?.fee_amount }}</div>
          <v-btn color="primary" @click="confirmPayment">Pay (mock)</v-btn>
        </v-card-text>
        <v-card-actions><v-btn text @click="showPayment = false">Close</v-btn></v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script>
import kycService from '@/services/Eventservice'
import DynamicField from '@/components/DynamicField.vue'

export default {
  name: 'KycFormPage',
  components: { DynamicField },

  data() {
    return {
      types: [],
      selectedType: null,
      selectedTypeObj: null,
      loading: false,

      // dynamic config
      steps: [], // raw steps (from backend)
      stepLabels: {}, // map step_key -> label
      fields: [], // raw fields array
      fieldsByStep: {}, // grouped fields
      stepOrder: [], // ordered array of step_key by sequence

      // runtime
      step: 1,
      formModel: {},

      showPayment: false,
    }
  },

  computed: {
    requiredRule() {
      return (v) => !!v || 'Select a type'
    },
  },

  mounted() {
    this.loadTypes()
  },

  methods: {
    async loadTypes() {
      const res = await kycService.getTypes()
      // expecting array of { type_key, label, fee_amount }
      this.types = Array.isArray(res) ? res : res?.data || []
    },

    onTypeSelected() {
      this.selectedTypeObj = this.types.find((t) => t.type_key === this.selectedType) || null
    },

    async beginKyc() {
      if (!this.selectedType) return alert('Choose a KYC type')

      this.loading = true
      try {
        // fetch steps metadata and fields for selected type
        const stepsRes = await kycService.getSteps()
        const rawSteps = Array.isArray(stepsRes) ? stepsRes : stepsRes?.data || []

        // map labels & sort by sequence (defensive)
        rawSteps.sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
        this.steps = rawSteps
        this.stepLabels = {}
        rawSteps.forEach((s) => {
          this.stepLabels[s.step_key] = s.step_label || s.step_key
        })

        // fetch fields for the selected type
        const fieldsRes = await kycService.getFields(this.selectedType)
        const rawFields = Array.isArray(fieldsRes) ? fieldsRes : fieldsRes?.data || []
        this.fields = rawFields

        // group fields by step_key (normalize keys to match steps)
        const map = {}
        for (const f of rawFields) {
          const key = (f.step_key || '').toString()
          if (!map[key]) map[key] = []
          map[key].push(f)
        }
        // sort within step by sequence
        for (const k in map) {
          map[k].sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
        }
        this.fieldsByStep = map

        // build stepOrder using steps list but only include steps that exist in fields or include all steps
        this.stepOrder = rawSteps.map((s) => s.step_key).filter((skey) => skey) // keep order from steps

        // initialize formModel for all fields
        this.formModel = { type_key: this.selectedType }
        for (const skey of this.stepOrder) {
          const fields = this.fieldsByStep[skey] || []
          for (const f of fields) {
            if (!(f.field_key in this.formModel)) {
              if (f.type === 'checkbox') this.formModel[f.field_key] = false
              else if (f.type === 'repeatable') this.formModel[f.field_key] = []
              else this.formModel[f.field_key] = ''
            }
          }
        }

        // set to first step
        this.step = 1
      } catch (e) {
        console.error('beginKyc error', e)
        alert('Failed to load form configuration')
      } finally {
        this.loading = false
      }
    },

    formatLabel(k) {
      if (!k) return ''
      return k.charAt(0).toUpperCase() + k.slice(1)
    },

    getFormRef(stepKey) {
      // refs created via v-for become arrays in Vue 3; create unique ref name
      return `form_${stepKey}`
    },

    async validateFormRef(stepKey) {
      const refName = this.getFormRef(stepKey)
      const ref = this.$refs[refName]
      // if ref is array (because of v-for) pick first element
      const form = Array.isArray(ref) ? ref[0] : ref
      if (!form) return true
      try {
        const r = await form.validate()
        return typeof r === 'boolean' ? r : (r?.valid ?? true)
      } catch {
        return false
      }
    },

    async next(idx, stepKey) {
      // idx is 1-based index of step
      // 1) validate current step
      const valid = await this.validateFormRef(stepKey)
      if (!valid) return // DO NOT move next if invalid

      // 2) optionally save to backend
      try {
        await kycService.saveStep(stepKey, { ...this.formModel, _step: stepKey })
      } catch (e) {
        console.warn('save step failed (non-blocking)', e)
      }

      // 3) move step or open payment
      if (idx === this.stepOrder.length) {
        this.showPayment = true
      } else {
        this.step = idx + 1
      }
    },

    prevStep() {
      if (this.step > 1) this.step--
    },

    async confirmPayment() {
      // mock payment handling
      try {
        await kycService.saveKyc({
          type_key: this.selectedType,
          json_data: JSON.stringify(this.formModel),
        })
        alert('KYC saved and payment simulated')
        this.showPayment = false
        // reset UI
        this.stepOrder = []
        this.fieldsByStep = {}
        this.formModel = {}
        this.selectedType = null
        this.selectedTypeObj = null
      } catch (e) {
        console.error(e)
        alert('Payment/save failed')
      }
    },
  },
}
</script>
