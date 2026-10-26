/** Controlled Profile reference selection; never changes signed identity or request scope. */
import { useEffect, useState } from 'react';
import { Autocomplete, TextField } from '@mui/material';
import type { OperationalOwnerConfiguration } from './operationalOwnerClient';
import {
  searchProfileEnterprises,
  type ProfileEnterpriseOption,
} from './profileEnterpriseLookup';

export function ProfileEnterpriseSelector({
  configuration,
  value,
  onChange,
  disabled,
  label,
  searchEnterprises = searchProfileEnterprises,
}: {
  configuration: OperationalOwnerConfiguration;
  value: ProfileEnterpriseOption | null;
  onChange: (value: ProfileEnterpriseOption | null) => void;
  disabled: boolean;
  label: string;
  searchEnterprises?: typeof searchProfileEnterprises;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState('');
  const [options, setOptions] = useState<{
      configuration: OperationalOwnerConfiguration;
      search: string;
      rows: ProfileEnterpriseOption[];
    }>(),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open || disabled) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setOptions(undefined);
      setError('');
      setLoading(true);
      void searchEnterprises(configuration, search, controller.signal)
        .then((rows) => {
          if (!controller.signal.aborted) setOptions({ configuration, search, rows });
        })
        .catch(() => {
          if (!controller.signal.aborted) setError('Enterprise lookup is unavailable.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [configuration, disabled, open, search, searchEnterprises]);
  return (
    <Autocomplete
      options={
        options?.configuration === configuration && options.search === search
          ? options.rows
          : []
      }
      value={value}
      disabled={disabled}
      loading={loading}
      onOpen={() => {
        setOptions(undefined);
        setError('');
        setLoading(true);
        setOpen(true);
      }}
      onClose={() => setOpen(false)}
      filterOptions={(rows) => rows}
      getOptionLabel={(row) => row.label}
      isOptionEqualToValue={(a, b) => a.code === b.code}
      onInputChange={(_event, text, reason) => {
        if (reason === 'input' || reason === 'clear') {
          setOptions(undefined);
          setError('');
          setLoading(true);
          setSearch(text);
        }
      }}
      onChange={(_event, selected) => onChange(selected)}
      renderInput={(params) => (
        <TextField {...params} label={label} error={!!error} helperText={error} />
      )}
    />
  );
}
