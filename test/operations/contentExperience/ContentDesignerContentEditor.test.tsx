import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ContentDesignerContentEditor } from '../../../src/operations/contentExperience/ContentDesignerContentEditor';
import type { DesignerContentValues } from '../../../src/operations/contentExperience/contentDesignerContentModel';
import type { ContentDesignerContentField } from '../../../src/operations/contentExperience/api/contentDesignerClient';

const fields: readonly ContentDesignerContentField[] = [
  { property: 'title', label: 'Heading', control: 'text', required: true },
  {
    property: 'items',
    label: 'Cards',
    control: 'items',
    required: true,
    maximumItems: 2,
    itemLabel: 'Card',
    itemFields: [
      { property: 'title', label: 'Card heading', control: 'text', required: true },
    ],
  },
];
function Editor() {
  const [values, setValues] = useState<DesignerContentValues>({});
  const [locale, setLocale] = useState('en');
  return (
    <>
      <button onClick={() => setLocale(locale === 'en' ? 'ar' : 'en')}>
        Switch language
      </button>
      <ContentDesignerContentEditor
        scope="site-a"
        slots={['body']}
        fields={fields}
        propertySchema={{ title: { localized: true } }}
        defaultLocale="en"
        locale={locale}
        values={values}
        onChange={(key, property, value) =>
          setValues((previous) => ({
            ...previous,
            [key]: { ...previous[key], [property]: value },
          }))
        }
      />
    </>
  );
}

describe('business content controls', () => {
  it('keeps entered translations separate and preserves the default heading', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.type(screen.getByRole('textbox', { name: 'Heading' }), 'Our services');
    await user.click(screen.getByRole('button', { name: 'Switch language' }));
    expect(screen.getByRole('textbox', { name: 'Heading' })).toHaveValue('');
    expect(
      screen.getByText('Leave a translation blank to use the default language.'),
    ).toBeVisible();
    await user.type(screen.getByRole('textbox', { name: 'Heading' }), 'خدماتنا');
    await user.click(screen.getByRole('button', { name: 'Switch language' }));
    expect(screen.getByRole('textbox', { name: 'Heading' })).toHaveValue(
      'Our services',
    );
    await user.click(screen.getByRole('button', { name: 'Switch language' }));
    expect(screen.getByRole('textbox', { name: 'Heading' })).toHaveValue('خدماتنا');
  });
  it('adds, reorders and removes cards while respecting the owner limit', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole('button', { name: 'Add card' }));
    await user.type(
      within(screen.getByRole('group', { name: 'Card 1' })).getByRole('textbox'),
      'First',
    );
    await user.click(screen.getByRole('button', { name: 'Add card' }));
    await user.type(
      within(screen.getByRole('group', { name: 'Card 2' })).getByRole('textbox'),
      'Second',
    );
    expect(screen.getByRole('button', { name: 'Add card' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Card 1 up' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Move Card 2 up' }));
    expect(
      within(screen.getByRole('group', { name: 'Card 1' })).getByRole('textbox'),
    ).toHaveValue('Second');
    expect(
      within(screen.getByRole('group', { name: 'Card 2' })).getByRole('textbox'),
    ).toHaveValue('First');
    await user.click(screen.getByRole('button', { name: 'Remove Card 1' }));
    expect(
      within(screen.getByRole('group', { name: 'Card 1' })).getByRole('textbox'),
    ).toHaveValue('First');
    expect(screen.queryByRole('group', { name: 'Card 2' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add card' })).toBeEnabled();
  });
});

it('associates a required field error after blur, clears it when corrected, and permits blank translation fallback', async () => {
  const user = userEvent.setup();
  render(<Editor />);
  const heading = screen.getByRole('textbox', { name: 'Heading' });
  await user.click(heading);
  await user.tab();
  expect(heading).toHaveAttribute('aria-invalid', 'true');
  expect(heading).toHaveAccessibleDescription(
    'Complete the required headings, card details, and default language content before validating.',
  );
  await user.type(heading, 'Restored heading');
  expect(heading).toHaveAttribute('aria-invalid', 'false');
  await user.click(screen.getByRole('button', { name: 'Switch language' }));
  const translation = screen.getByRole('textbox', { name: 'Heading' });
  await user.click(translation);
  await user.tab();
  expect(translation).not.toBeRequired();
  expect(translation).toHaveAttribute('aria-invalid', 'false');
  expect(translation).toHaveAccessibleDescription(
    'Leave a translation blank to use the default language.',
  );
});
