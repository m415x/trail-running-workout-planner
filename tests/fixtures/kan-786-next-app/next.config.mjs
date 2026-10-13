// KAN-786 integration-only Next application; default Server Action body limit.
// Invoked with next dev --webpack so that pnpm workspace/Turbopack root
// discovery cannot include the main application's proxy or route graph.
export default { devIndicators: false }
