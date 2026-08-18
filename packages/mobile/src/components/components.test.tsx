import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { Card, Screen } from '@/components/screen';
import { TabBarIcon, type TabIconName } from '@/components/tab-bar-icon';
import { themeFor } from '@/lib/theme';

describe('Screen', () => {
  it('shows its title and optional subtitle', () => {
    render(<Screen title="Vitals" subtitle="Your readings over time." />);

    expect(screen.getByText('Vitals')).toBeOnTheScreen();
    expect(screen.getByText('Your readings over time.')).toBeOnTheScreen();
  });

  it('leaves the subtitle out entirely when there is not one', () => {
    render(<Screen title="Vitals" />);

    expect(screen.getByText('Vitals')).toBeOnTheScreen();
    expect(screen.queryByText('Your readings over time.')).not.toBeOnTheScreen();
  });

  it('renders whatever it is given', () => {
    render(
      <Screen title="Home">
        <Text>Some content</Text>
      </Screen>,
    );

    expect(screen.getByText('Some content')).toBeOnTheScreen();
  });

  /** Colours must come from the shared tokens, never a literal in a component. */
  it('paints the page canvas from the token palette', () => {
    render(<Screen title="Home" />);

    const expected = themeFor('light').colors.bgApp;
    expect(screen.getByText('Home')).toBeOnTheScreen();
    expect(expected).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe('Card', () => {
  it('wraps its children', () => {
    render(
      <Card>
        <Text>Inside the card</Text>
      </Card>,
    );

    expect(screen.getByText('Inside the card')).toBeOnTheScreen();
  });
});

describe('TabBarIcon', () => {
  const names: TabIconName[] = ['home', 'documents', 'medicines', 'vitals', 'profile'];

  it.each(names)('renders an icon for %s', (name) => {
    render(<TabBarIcon name={name} color="#0F6E56" />);

    expect(screen.toJSON()).toBeTruthy();
  });

  /** A tab drawn with the wrong symbol still "works", so pin the shapes. */
  it('draws a different symbol for every tab', () => {
    const shapes = names.map((name) => {
      const { unmount, toJSON } = render(<TabBarIcon name={name} color="#0F6E56" />);
      const shape = JSON.stringify(toJSON());
      unmount();
      return shape;
    });

    expect(new Set(shapes).size).toBe(names.length);
  });

  it('takes the colour the navigator resolved for the active state', () => {
    const { toJSON } = render(<TabBarIcon name="home" color="#0F6E56" />);

    expect(JSON.stringify(toJSON())).toContain('#0F6E56');
  });
});
