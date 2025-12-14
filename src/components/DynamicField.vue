<template>
  <div>
    <v-text-field
      v-if="field.type === 'text' || field.type === 'number'"
      :label="field.label"
      :type="field.type === 'number' ? 'number' : 'text'"
      v-model="localValue"
      :rules="rules"
      @update:modelValue="emitUpdate"
      @input="emitUpdate"
    />

    <v-text-field
      v-else-if="field.type === 'date'"
      :label="field.label"
      type="date"
      v-model="localValue"
      :rules="rules"
      @input="emitUpdate"
    />

    <v-text-field
      v-else-if="field.type === 'email'"
      :label="field.label"
      type="email"
      v-model="localValue"
      :rules="rules"
      @input="emitUpdate"
    />

    <v-select
      v-else-if="field.type === 'select'"
      :label="field.label"
      :items="parsedItems"
      v-model="localValue"
      :rules="rules"
      @update:modelValue="emitUpdate"
    />

    <v-checkbox
      v-else-if="field.type === 'checkbox'"
      :label="field.label"
      v-model="localValue"
      @update:modelValue="emitUpdate"
    />

    <v-radio-group
      v-else-if="field.type === 'radio'"
      v-model="localValue"
      @update:modelValue="emitUpdate"
      row
    >
      <v-radio v-for="it in parsedItems" :key="it" :label="it" :value="it" />
    </v-radio-group>

    <RepeatablePromoters v-else-if="field.type === 'repeatable'" v-model="localValue" />

    <!-- fallback -->
    <v-text-field v-else :label="field.label" v-model="localValue" @input="emitUpdate" />
  </div>
</template>

<script>
import RepeatablePromoters from './RepeatablePromoters.vue'

export default {
  name: 'DynamicField',
  components: { RepeatablePromoters },
  props: {
    field: { type: Object, required: true },
    modelValue: { required: false },
    rulesFromServer: { type: Array, default: () => [] }, // optional
  },
  emits: ['update:modelValue'],
  data() {
    return {
      localValue: this.modelValue,
    }
  },
  watch: {
    modelValue(val) {
      this.localValue = val
    },
  },
  computed: {
    parsedItems() {
      if (!this.field.items) return []
      try {
        if (Array.isArray(this.field.items)) return this.field.items
        return JSON.parse(this.field.items)
      } catch {
        // if it's comma separated string
        return String(this.field.items)
          .split(',')
          .map((s) => s.trim())
      }
    },
    rules() {
      // Build rules from field.required (backend) + optional extra rules
      const r = []
      if (this.field.required) r.push((v) => !!v || `${this.field.label} is required`)
      // additional built-in patterns:
      if (this.field.field_key === 'pincode')
        r.push((v) => !v || /^[0-9]{6}$/.test(v) || 'Invalid pincode')
      if (this.field.field_key === 'registrationNo' || this.field.field_key === 'pan')
        r.push((v) => !v || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v) || 'Invalid PAN')
      if (this.field.type === 'email' || this.field.field_key === 'contractNoteEmail')
        r.push((v) => !v || /.+@.+\..+/.test(v) || 'Invalid email')
      return r.concat(this.rulesFromServer || [])
    },
  },
  methods: {
    emitUpdate() {
      this.$emit('update:modelValue', this.localValue)
    },
  },
}
</script>
