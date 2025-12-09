import { ChangeEvent } from 'react';
import { Clear as ClearIcon, Search as SearchIcon } from '@mui/icons-material';
import { Box, CircularProgress, InputBase, Paper, Typography } from '@mui/material';

import { useB3Lang } from '@/lib/lang';

interface EpicorSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  isLoading: boolean;
  loadingProgress?: {
    fetched: number;
    total: number;
  };
}

/**
 * Dedicated search input for Epicor Order IDs
 *
 * Distinct from main order search - triggers client-side filtering
 * of all orders after loading them from API.
 */
export default function EpicorSearchInput({
  value,
  onChange,
  onClear,
  isLoading,
  loadingProgress,
}: EpicorSearchInputProps) {
  const b3Lang = useB3Lang();

  const handleOnChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleClear = () => {
    onClear();
  };

  return (
    <Box
      sx={{
        width: '100%',
        mb: '20px',
      }}
    >
      <Paper
        component="div"
        sx={{
          p: '2px 4px',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          border: '2px solid #1976d2', // Distinct blue border
          boxShadow: '0 2px 8px rgba(25, 118, 210, 0.15)', // Subtle blue shadow
          height: '50px',
          borderRadius: '4px',
          backgroundColor: '#f5f9ff', // Light blue background to distinguish from main search
          '&:hover': {
            borderColor: '#1565c0',
            boxShadow: '0 2px 12px rgba(25, 118, 210, 0.25)',
          },
        }}
      >
        <SearchIcon
          sx={{
            p: '10px',
            color: '#1976d2', // Blue icon to match border
            fontSize: '2.7rem',
          }}
        />
        <InputBase
          sx={{
            ml: 1,
            flex: 1,
            '& .MuiInputBase-input': {
              pb: 0,
            },
          }}
          size="small"
          value={value}
          placeholder={b3Lang('orders.epicorIdPlaceholder')}
          onChange={handleOnChange}
          disabled={isLoading}
          endAdornment={
            <>
              {isLoading && (
                <CircularProgress
                  size={20}
                  sx={{
                    marginRight: '12px',
                    color: '#1976d2',
                  }}
                />
              )}
              {value.length > 0 && !isLoading && (
                <ClearIcon
                  sx={{
                    marginRight: '8px',
                    cursor: 'pointer',
                    padding: '4px',
                    fontSize: '1.8rem',
                    color: '#1976d2',
                    ':hover': {
                      backgroundColor: 'rgba(25, 118, 210, 0.08)',
                      borderRadius: '48px',
                    },
                  }}
                  onClick={handleClear}
                />
              )}
            </>
          }
        />
      </Paper>

      {/* Loading progress indicator */}
      {isLoading && loadingProgress && loadingProgress.total > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mt: '8px',
            gap: '8px',
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: '#1976d2',
              fontSize: '0.875rem',
            }}
          >
            {b3Lang('orders.searchingOrders', {
              fetched: loadingProgress.fetched.toString(),
              total: loadingProgress.total.toString(),
            })}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
