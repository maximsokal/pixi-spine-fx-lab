module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'shared-core-does-not-depend-on-effects',
      comment: 'Shared template utilities must not depend on individual effect implementations.',
      severity: 'error',
      from: {
        path: '^assets/template/src/(?:curve|spacing|path|color|timeline|emitter)-core\\.js$',
      },
      to: { path: '^assets/(?!template/)[^/]+/src/' },
    },
    {
      name: 'runtime-does-not-import-tooling',
      comment: 'Browser runtime modules must not import repository test or build scripts.',
      severity: 'error',
      from: { path: '^assets/[^/]+/src/' },
      to: { path: '^scripts/' },
    },
  ],
};
