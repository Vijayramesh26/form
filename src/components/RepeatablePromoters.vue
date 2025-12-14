<template>
  <div>
    <div v-for="(p, idx) in promoters" :key="idx" class="pa-3 mb-4" style="border: 1px dashed #ddd">
      <v-text-field v-model="promoters[idx].name" label="Full name" @input="emitUpdate" />
      <v-text-field v-model="promoters[idx].pan" label="PAN" @input="emitUpdate" />
      <v-text-field v-model="promoters[idx].din" label="DIN" @input="emitUpdate" />
      <v-text-field v-model="promoters[idx].aadhar" label="Aadhar" @input="emitUpdate" />
      <v-btn text color="red" @click="remove(idx)">Remove</v-btn>
    </div>

    <v-btn small color="primary" @click="add">Add Promoter</v-btn>
  </div>
</template>

<script>
export default {
  name: 'RepeatablePromoters',
  props: {
    modelValue: {
      type: Array,
      default: () => [],
    },
  },
  emits: ['update:modelValue'],
  data() {
    return {
      promoters: JSON.parse(JSON.stringify(this.modelValue || [])),
    }
  },
  watch: {
    modelValue: {
      deep: true,
      handler(newVal) {
        this.promoters = JSON.parse(JSON.stringify(newVal || []))
      },
    },
  },
  methods: {
    emitUpdate() {
      this.$emit('update:modelValue', JSON.parse(JSON.stringify(this.promoters)))
    },
    add() {
      this.promoters.push({ name: '', pan: '', din: '', aadhar: '' })
      this.emitUpdate()
    },
    remove(i) {
      this.promoters.splice(i, 1)
      this.emitUpdate()
    },
  },
}
</script>
