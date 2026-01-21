import { SyntheticEvent, useEffect, useRef, useState } from 'react';
import { Resizable } from 'react-resizable';
import { Box, Typography } from '@mui/material';
// cspell:disable-next-line
import PDFObject from 'pdfobject';

import B3Spin from '@/components/spin/B3Spin';
import { InvoiceList } from '@/types/invoice';
import { snackbar } from '@/utils/b3Tip';

import { getEpicorOrderId } from '../../customizations';
import { getInvoicePdfUrl } from '../utils/pdf';

const templateMinHeight = 300;

interface PrintTemplateProps {
  row: InvoiceList;
}

function PrintTemplate({ row }: PrintTemplateProps) {
  const container = useRef<HTMLInputElement | null>(null);

  const dom = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState<boolean>(false);

  const [height, setHeight] = useState<number>(templateMinHeight);

  const onFirstBoxResize = (
    _: SyntheticEvent<Element, Event>,
    { size }: { size: { height: number } },
  ) => {
    setHeight(size.height);
  };

  useEffect(() => {
    const viewPrint = async () => {
      setLoading(true);
      try {
        const invoicePDFUrl = await getInvoicePdfUrl(row);

        if (container.current) {
          PDFObject.embed(invoicePDFUrl, container.current);
        }
      } catch (e) {
        snackbar.error('Error generating PDF');
      } finally {
        setLoading(false);
      }
    };

    viewPrint();

    return () => {
      container.current = null;
    };
  }, [row]);

  const epicorOrderId = getEpicorOrderId(row);

  return (
    <B3Spin isSpinning={loading}>
      <Box
        ref={dom}
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          width: '100%',
          '& .box': {
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            width: '100%',
            '& .react-resizable': {
              position: 'relative',
            },
            '& .react-resizable-handle': {
              position: 'absolute',
              width: '100%',
              height: '30px',
              backgroundRepeat: 'no-repeat',
              backgroundOrigin: 'content-box',
              boxSizing: 'border-box',
            },
            '& .react-resizable-handle-s': {
              cursor: 'ns-resize',
              bottom: 0,
            },
          },
        }}
      >
        {(epicorOrderId || row.orderNumber) && (
          <Box
            sx={{
              width: '100%',
              padding: '10px 16px',
              backgroundColor: '#f5f5f5',
              borderBottom: '1px solid #e0e0e0',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
              Order ID: {epicorOrderId || row.orderNumber}
            </Typography>
          </Box>
        )}
        <Resizable
          className="box"
          height={height}
          minConstraints={[dom?.current?.offsetWidth || 0, 0]}
          width={dom.current?.offsetWidth || 0}
          onResize={onFirstBoxResize}
          resizeHandles={['s']}
        >
          <div style={{ width: '100%', height: `${height}px` }}>
            <div ref={container} style={{ height: '100%', width: '100%' }} />
          </div>
        </Resizable>
      </Box>
    </B3Spin>
  );
}

export default PrintTemplate;