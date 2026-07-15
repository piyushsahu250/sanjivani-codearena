import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Several pages independently lazy-import these same heavy libraries (Monaco on
        // LessonView/QuestionBank/CreateQuestion, tfjs+blazeface on TestTaking/InterviewSession/
        // ModuleCodingAssessment, recharts on the 5 dashboard/analytics pages). Without explicit
        // grouping, Rollup can end up bundling a separate copy of the same library into each
        // page's own chunk; pinning each to one named vendor chunk means it's fetched once and
        // reused across every page that needs it.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('monaco-editor') || id.includes('@monaco-editor')) return 'vendor-monaco'
          if (id.includes('@tensorflow') || id.includes('blazeface')) return 'vendor-tfjs'
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-recharts'
          return undefined
        },
      },
    },
  },
})
