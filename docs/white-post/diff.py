import sys
import numpy as np
from PIL import Image
a = np.array(Image.open(sys.argv[1]).convert("L")).astype(float)
b = np.array(Image.open(sys.argv[2]).convert("L")).astype(float)
print("mean abs diff", round(np.abs(a - b).mean(), 3), "max zone", round(np.abs(a-b).max(),1))
# superposition : original en rouge, rendu en cyan → noir là où ils coïncident
out = np.stack([b, a, a], axis=2).astype(np.uint8)
Image.fromarray(out).save(sys.argv[3], quality=90)
