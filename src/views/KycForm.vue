<template>
  <v-container fluid class="fill-height bg-grey-lighten-4 pa-0 pa-sm-4">
    <v-row justify="center" align="start" class="ma-0 fill-height">
      <v-col cols="12" md="8" lg="6" class="pa-0 pa-sm-4">
        <v-fade-transition hide-on-leave>
          <v-card
            v-if="stepOrder.length === 0"
            :flat="$vuetify.display.xs"
            class="rounded-sm-lg pa-4 pa-sm-10 fill-height fill-height-sm-initial"
          >
            <div class="text-center mb-6">
              <v-icon color="primary" size="48" class="mb-4">mdi-shield-check</v-icon>
              <h1 class="text-h5 font-weight-bold">Identity Verification</h1>
              <p class="text-body-2 text-medium-emphasis">Select a method to start</p>
            </div>

            <v-autocomplete
              v-model="selectedType"
              :items="types"
              item-value="type_key"
              item-title="label"
              label="Verification Type"
              variant="outlined"
              density="comfortable"
            />

            <v-expand-transition>
              <v-card
                v-if="selectedTypeObj"
                color="primary-lighten-5"
                flat
                class="pa-4 mb-6 rounded-lg"
              >
                <div class="d-flex justify-space-between align-center">
                  <span class="text-subtitle-2 text-primary">Service Fee</span>
                  <span class="text-h6 font-weight-bold text-primary"
                    >${{ selectedTypeObj.fee_amount }}</span
                  >
                </div>
              </v-card>
            </v-expand-transition>

            <v-btn
              block
              size="x-large"
              color="primary"
              variant="elevated"
              :loading="loading"
              @click="beginKyc"
              class="rounded-pill"
            >
              Start Now
            </v-btn>
          </v-card>
        </v-fade-transition>

        <v-fade-transition>
          <v-card
            v-if="stepOrder.length > 0"
            :flat="$vuetify.display.xs"
            class="rounded-sm-lg overflow-hidden d-flex flex-column"
            style="min-height: 100vh; min-height: -webkit-fill-available"
          >
            <v-progress-linear
              :model-value="(step / stepOrder.length) * 100"
              color="primary"
              height="6"
            />

            <v-stepper v-model="step" flat class="bg-transparent">
              <v-stepper-header class="elevation-0 border-b">
                <template v-for="(skey, idx) in stepOrder" :key="skey">
                  <v-stepper-item
                    :value="idx + 1"
                    :complete="step > idx + 1"
                    :title="$vuetify.display.smAndUp ? stepLabels[skey] || formatLabel(skey) : ''"
                  />
                  <v-divider v-if="idx !== stepOrder.length - 1" :key="'d' + skey" />
                </template>
              </v-stepper-header>

              <v-stepper-window v-model="step">
                <v-stepper-window-item
                  v-for="(skey, idx) in stepOrder"
                  :key="skey"
                  :value="idx + 1"
                  class="pa-4 pa-sm-8"
                >
                  <v-form :ref="getFormRef(skey)">
                    <div class="mb-6">
                      <div class="text-overline text-primary mb-1">
                        Step {{ idx + 1 }} of {{ stepOrder.length }}
                      </div>
                      <h2 class="text-h6 font-weight-bold">
                        {{ stepLabels[skey] || formatLabel(skey) }}
                      </h2>
                    </div>

                    <v-row>
                      <v-col
                        v-for="field in fieldsByStep[skey] || []"
                        :key="field.field_key"
                        cols="12"
                        class="py-2"
                      >
                        <DynamicField
                          :field="field"
                          v-model="formModel[field.field_key]"
                          variant="outlined"
                          density="comfortable"
                        />
                      </v-col>
                    </v-row>
                  </v-form>

                  <v-divider class="my-6 d-sm-none" />
                  <div
                    :class="[
                      'd-flex mt-6 ga-3',
                      $vuetify.display.xs ? 'flex-column' : 'justify-space-between',
                    ]"
                  >
                    <v-btn
                      :block="$vuetify.display.xs"
                      size="large"
                      variant="tonal"
                      @click="prevStep"
                      :disabled="step === 1"
                      class="order-2 order-sm-1"
                    >
                      Back
                    </v-btn>
                    <v-btn
                      :block="$vuetify.display.xs"
                      size="large"
                      color="primary"
                      @click="next(idx + 1, skey)"
                      class="order-1 order-sm-2"
                    >
                      {{ idx + 1 === stepOrder.length ? 'Finalize' : 'Continue' }}
                    </v-btn>
                  </div>
                </v-stepper-window-item>
              </v-stepper-window>
            </v-stepper>
          </v-card>
        </v-fade-transition>
      </v-col>
    </v-row>
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
  watch: {
    selectedType() {
      this.onTypeSelected()
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
      this.selectedTypeObj =
        this.types.find((t) => {
          return t.type_key === this.selectedType
        }) || null
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
