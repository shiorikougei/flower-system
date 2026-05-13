-- ===============================================================
-- 在庫の原子的減算 RPC関数
-- ---------------------------------------------------------------
-- 並行注文時に在庫がマイナスにならないようにする
-- 1つのトランザクション内で在庫チェック+減算を行う
--
-- 使い方:
--   const { data, error } = await supabase.rpc('decrement_stock', {
--     p_product_id: 'xxx',
--     p_qty: 2,
--   });
--   data: { success: true, new_stock: 3 } または { success: false, reason: '...' }
-- ===============================================================

CREATE OR REPLACE FUNCTION public.decrement_stock(
  p_product_id uuid,
  p_qty integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_stock integer;
  v_product_name text;
  v_new_stock integer;
BEGIN
  -- 行レベルロックして在庫を取得
  SELECT stock, name INTO v_current_stock, v_product_name
  FROM public.products
  WHERE id = p_product_id
  FOR UPDATE;

  -- 商品が見つからない
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'product_not_found'
    );
  END IF;

  -- 在庫不足
  IF v_current_stock < p_qty THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'insufficient_stock',
      'current_stock', v_current_stock,
      'requested', p_qty,
      'product_name', v_product_name
    );
  END IF;

  -- 減算
  v_new_stock := v_current_stock - p_qty;
  UPDATE public.products SET stock = v_new_stock WHERE id = p_product_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_stock', v_new_stock,
    'product_name', v_product_name
  );
END;
$$;


-- ===============================================================
-- 在庫の戻し（注文キャンセル時など）
-- ===============================================================
CREATE OR REPLACE FUNCTION public.increment_stock(
  p_product_id uuid,
  p_qty integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_stock integer;
BEGIN
  UPDATE public.products
  SET stock = stock + p_qty
  WHERE id = p_product_id
  RETURNING stock INTO v_new_stock;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'reason', 'product_not_found');
  END IF;

  RETURN jsonb_build_object('success', true, 'new_stock', v_new_stock);
END;
$$;
