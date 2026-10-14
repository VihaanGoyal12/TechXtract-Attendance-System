import os
from typing import Optional, Tuple
from PIL import Image

CODE128_PATTERNS = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
]

PATTERN_TO_VAL = {pat: i for i, pat in enumerate(CODE128_PATTERNS)}

def decode_symbols_to_text(symbols: list) -> Optional[str]:
    """
    Decodes list of symbol indices according to Code 128 specification (Subsets A, B, C with dynamic switching).
    """
    if not symbols or len(symbols) < 3:
        return None
    start = symbols[0]
    if start == 103:
        mode = 'A'
    elif start == 104:
        mode = 'B'
    elif start == 105:
        mode = 'C'
    else:
        return None

    text = []
    payload = symbols[1:-2] # Strip start, checksum, stop

    for val in payload:
        if mode == 'C':
            if val == 100:
                mode = 'B'
            elif val == 101:
                mode = 'A'
            elif 0 <= val <= 99:
                text.append(f'{val:02d}')
        elif mode == 'B':
            if val == 99:
                mode = 'C'
            elif val == 101:
                mode = 'A'
            elif 0 <= val <= 95:
                text.append(chr(val + 32))
        elif mode == 'A':
            if val == 99:
                mode = 'C'
            elif val == 100:
                mode = 'B'
            elif 0 <= val <= 63:
                text.append(chr(val + 32))
            elif 64 <= val <= 95:
                text.append(chr(val - 64))
    return ''.join(text)

def decode_code128_image(image_input) -> Tuple[Optional[str], Optional[str]]:
    """
    Decodes Code 128 barcode from a PIL Image or filepath.
    Returns (decoded_string, error_message).
    """
    try:
        if isinstance(image_input, str):
            if not os.path.exists(image_input):
                return None, f"File not found: {image_input}"
            img = Image.open(image_input).convert('L')
        elif isinstance(image_input, Image.Image):
            img = image_input.convert('L')
        else:
            img = Image.open(image_input).convert('L')

        w, h = img.size
        # Sample across multiple vertical lines to tolerate minor artifacts
        sample_ys = [h // 2, h // 3, (2 * h) // 3, h // 4]
        
        last_err = "No valid barcode scan line found"
        for y in sample_ys:
            row = [img.getpixel((x, y)) for x in range(w)]
            bw = [1 if p < 128 else 0 for p in row]
            black_indices = [i for i, b in enumerate(bw) if b == 1]
            if not black_indices:
                continue

            runs = []
            cur_val = bw[black_indices[0]]
            cur_len = 0
            for b in bw[black_indices[0]:black_indices[-1]+1]:
                if b == cur_val:
                    cur_len += 1
                else:
                    runs.append((cur_val, cur_len))
                    cur_val = b
                    cur_len = 1
            runs.append((cur_val, cur_len))

            if not runs:
                continue

            min_w = min(r[1] for r in runs)
            if min_w <= 0:
                continue

            norm = [str(round(w_len / min_w)) for val, w_len in runs]

            symbols = []
            i = 0
            while i < len(norm):
                if i + 7 == len(norm):
                    symbols.append(''.join(norm[i:i+7]))
                    break
                elif i + 6 <= len(norm):
                    symbols.append(''.join(norm[i:i+6]))
                    i += 6
                else:
                    symbols.append(''.join(norm[i:]))
                    break

            vals = [PATTERN_TO_VAL.get(s, -1) for s in symbols]
            if -1 in vals or len(vals) < 3 or vals[-1] != 106:
                continue

            # Checksum validation
            start = vals[0]
            check = vals[-2]
            data = vals[1:-2]
            total = start
            for idx, d in enumerate(data):
                total += (idx + 1) * d
            if total % 103 != check:
                last_err = f"Checksum mismatch: expected {check}, got {total % 103}"
                continue

            decoded_text = decode_symbols_to_text(vals)
            if decoded_text:
                return decoded_text, None

        return None, last_err
    except Exception as e:
        return None, str(e)
