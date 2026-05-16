-- ===============================================================
-- box_size のサイズ体系を「S/M/L/XL」→「業者配送サイズ(80/100/120等)」に正規化
-- ===============================================================
-- 既存の S/M/L/XL データを業者配送サイズ系にマッピング

UPDATE public.products SET box_size = '60'  WHERE box_size = 'S';
UPDATE public.products SET box_size = '80'  WHERE box_size = 'M' OR box_size IS NULL;
UPDATE public.products SET box_size = '100' WHERE box_size = 'L';
UPDATE public.products SET box_size = '120' WHERE box_size = 'XL';
