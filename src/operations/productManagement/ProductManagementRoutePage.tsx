import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import type {
  AxisAuthenticatedBootstrap,
  AxisNavigationItem,
} from '../../bootstrap/publicBootstrap';
import type { AxisRuntimeConfig } from '../../runtime/runtimeConfig';
import { WorkbenchRoutePage } from '../../workbench/WorkbenchRoutePage';
import { ProductLocalizationPreview } from './ProductLocalizationPreview';

interface ProductManagementRoutePageProps {
  readonly accessToken: string;
  readonly bootstrap: AxisAuthenticatedBootstrap;
  readonly channel: string;
  readonly cmsBaseUrl: string;
  readonly employeeId: string;
  readonly locale: string;
  readonly navigation: AxisNavigationItem;
  readonly runtime: AxisRuntimeConfig;
  readonly site: string;
}

type ProductTab = 'products' | 'en' | 'ar' | 'preview' | 'search';

const tabSchema: Readonly<Record<ProductTab, string>> = Object.freeze({
  products: 'product',
  en: 'productLocalization',
  ar: 'productLocalization',
  preview: 'productLocalization',
  search: 'productSearchProjection',
});

/**
 * Composes Product and locale records through backend-governed Workbench
 * schemas. The browser keeps only the selected tab and Product filter.
 */
export function ProductManagementRoutePage(props: ProductManagementRoutePageProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<ProductTab>('products');
  const [productCode, setProductCode] = useState('');
  const routeNavigation = useMemo<AxisNavigationItem>(() => {
    const fixedFilters = [];
    if (productCode.trim() && tab !== 'products') {
      fixedFilters.push({
        id: 'selected-product',
        label: `Product ${productCode.trim()}`,
        field: 'productCode',
        value: productCode.trim(),
        order: 10,
      });
    }
    if (tab === 'en' || tab === 'ar') {
      fixedFilters.push({
        id: 'selected-locale',
        label: tab === 'ar' ? 'Arabic' : 'English',
        field: 'locale',
        value: tab,
        order: 20,
      });
    }
    return {
      ...props.navigation,
      workbenchTarget: {
        moduleName: 'product',
        schemaName:
          tab === 'products'
            ? (props.navigation.workbenchTarget?.schemaName ?? tabSchema.products)
            : tabSchema[tab],
      },
      workbenchPresentation: {
        ...props.navigation.workbenchPresentation,
        defaultColumns:
          tab === 'products'
            ? props.navigation.workbenchPresentation?.defaultColumns
            : tab === 'search'
              ? ['productCode', 'storeCode', 'locale', 'status', 'projectedAt']
              : ['productCode', 'locale', 'name', 'status', 'revision'],
        fixedFilters,
      },
    };
  }, [productCode, props.navigation, tab]);

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h4">Product language management</Typography>
        <Typography color="text.secondary">
          One Product identity serves every language. Localized records contain
          presentation and search content only; SKU, price, tax, and inventory stay
          shared.
        </Typography>
      </Stack>
      <TextField
        helperText="Enter a Product code to scope language and search tabs to one Product."
        label="Selected Product code"
        onChange={(event) => setProductCode(event.target.value)}
        size="small"
        value={productCode}
      />
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {(
          [
            ['products', 'Products'],
            ['en', 'English'],
            ['ar', 'Arabic'],
            ['preview', 'Preview'],
            ['search', 'Search status'],
          ] as const
        ).map(([value, label]) => (
          <Button
            aria-pressed={tab === value}
            key={value}
            onClick={() => setTab(value)}
            variant={tab === value ? 'contained' : 'outlined'}
          >
            {label}
          </Button>
        ))}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Button
          onClick={() => {
            void navigate('/operations/imports-exports?area=file-imports');
          }}
          variant="text"
        >
          Bulk import languages
        </Button>
        <Button
          onClick={() => {
            void navigate('/operations/imports-exports?area=exports');
          }}
          variant="text"
        >
          Bulk export languages
        </Button>
      </Stack>
      {tab === 'en' || tab === 'ar' ? (
        <Alert severity={productCode.trim() ? 'info' : 'warning'}>
          {productCode.trim()
            ? `${tab === 'ar' ? 'Arabic' : 'English'} content for ${productCode.trim()}. Publication requires every configured mandatory locale to be READY.`
            : 'Select a Product code to get a focused language workspace. Until then, all records for this locale are shown.'}
        </Alert>
      ) : null}
      {tab === 'preview' ? (
        <ProductLocalizationPreview
          accessToken={props.accessToken}
          bootstrap={props.bootstrap}
          productCode={productCode}
          runtime={props.runtime}
        />
      ) : (
        <WorkbenchRoutePage
          accessToken={props.accessToken}
          bootstrap={props.bootstrap}
          channel={props.channel}
          cmsBaseUrl={props.cmsBaseUrl}
          employeeId={props.employeeId}
          locale={props.locale}
          routeNavigation={routeNavigation}
          routeSchema={routeNavigation.workbenchTarget}
          runtime={props.runtime}
          site={props.site}
        />
      )}
    </Stack>
  );
}
