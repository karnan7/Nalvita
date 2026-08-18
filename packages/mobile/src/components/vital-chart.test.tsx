import type { Vital } from '@nalvita/core';
import { render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';

import { VitalChart } from '@/components/vital-chart';
import { themeFor } from '@/lib/theme';
import { makeVitalRow } from '@/test/fixtures';

function vital(overrides: Record<string, unknown> = {}): Vital {
  return makeVitalRow(overrides) as unknown as Vital;
}

/**
 * Every `fill` in the rendered SVG.
 *
 * react-native-svg does not keep the hex string — it processes colours into
 * packed ARGB integers — so the comparison runs through `processColor` on both
 * sides rather than against `#1E7A52`.
 */
function fills(tree: unknown): unknown[] {
  const found: unknown[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const record = node as { props?: { fill?: { payload?: unknown } }; children?: unknown[] };
    const payload = record.props?.fill?.payload;
    if (payload !== undefined) found.push(payload);
    for (const child of record.children ?? []) walk(child);
  };
  walk(tree);
  return found;
}

/** The packed value react-native-svg will have stored for a hex colour. */
function packed(color: string): unknown {
  return processColor(color);
}

describe('with no readings', () => {
  it('says so rather than drawing an empty chart', () => {
    render(<VitalChart vitals={[]} type="blood_pressure" width={300} />);

    expect(screen.getByText('No readings in this period.')).toBeOnTheScreen();
  });
});

describe('with readings', () => {
  it('counts them and names the latest value', () => {
    render(
      <VitalChart
        vitals={[
          vital({ measured_at: '2026-07-20T08:00:00.000Z' }),
          vital({
            id: '00000000-0000-4000-8000-0000000000f2',
            value_1: 118,
            value_2: 76,
            measured_at: '2026-07-22T08:00:00.000Z',
          }),
        ]}
        type="blood_pressure"
        width={300}
      />,
    );

    expect(screen.getByText('2 readings')).toBeOnTheScreen();
    // Latest is the most recent by time, not the last in the array.
    expect(screen.getByText('Latest 118/76 mmHg')).toBeOnTheScreen();
  });

  it('reads a single reading in the singular', () => {
    render(<VitalChart vitals={[vital()]} type="blood_pressure" width={300} />);

    expect(screen.getByText('1 reading')).toBeOnTheScreen();
  });

  /** A flat series would divide by zero when scaling; it must still draw. */
  it('survives every reading being identical', () => {
    expect(() =>
      render(
        <VitalChart
          vitals={[
            vital({ value_1: 120, value_2: 80 }),
            vital({ id: '00000000-0000-4000-8000-0000000000f2', value_1: 120, value_2: 80 }),
          ]}
          type="blood_pressure"
          width={300}
        />,
      ),
    ).not.toThrow();
  });

  it('orders points oldest first, whatever order they arrive in', () => {
    render(
      <VitalChart
        vitals={[
          vital({ value_1: 150, measured_at: '2026-07-25T08:00:00.000Z' }),
          vital({
            id: '00000000-0000-4000-8000-0000000000f2',
            value_1: 110,
            measured_at: '2026-07-01T08:00:00.000Z',
          }),
        ]}
        type="blood_pressure"
        width={300}
      />,
    );

    // The newest reading is 150, so that is what "Latest" must report.
    expect(screen.getByText(/Latest 150/)).toBeOnTheScreen();
  });
});

describe('colour', () => {
  /**
   * Each point carries its own clinical status, which is the reason this is
   * hand-drawn rather than handed to a charting library.
   */
  it('paints a normal reading green and a high one red', () => {
    const light = themeFor('light');

    const normal = render(
      <VitalChart
        vitals={[vital({ value_1: 115, value_2: 75 })]}
        type="blood_pressure"
        width={300}
      />,
    );
    expect(fills(normal.toJSON())).toContain(packed(light.status.normal.fg));
    normal.unmount();

    const high = render(
      <VitalChart
        vitals={[vital({ value_1: 180, value_2: 120 })]}
        type="blood_pressure"
        width={300}
      />,
    );
    expect(fills(high.toJSON())).toContain(packed(light.status.critical.fg));
  });

  /** Weight has no healthy range, so a point must not be coloured as a verdict. */
  it('leaves weight in the neutral interactive colour', () => {
    const light = themeFor('light');

    const { toJSON } = render(
      <VitalChart
        vitals={[vital({ type: 'weight', value_1: 70, value_2: null })]}
        type="weight"
        width={300}
      />,
    );

    const painted = fills(toJSON());
    expect(painted).toContain(packed(light.colors.interactiveDefault));
    expect(painted).not.toContain(packed(light.status.critical.fg));
  });
});
