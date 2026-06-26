/** Fixture config for the CLI integration tests. Exercises both a factory export and a default. */
export function buildConfig() {
  return {
    save: { title: 'Save', text: 'Saves your input.' },
    ghost: { title: 'Ghost', text: 'Defined but never referenced in the markup.' },
  };
}

export default {
  save: { title: 'Save', text: 'Saves your input.' },
};
