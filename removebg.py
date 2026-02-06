import cv2
import numpy as np
def remover_fundo(imagem_entrada, imagem_saida):
    img = cv2.imread(imagem_entrada)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    verde_claro = np.array([35, 40, 40])
    verde_escuro = np.array([85, 255, 255])
    mascara = cv2.inRange(hsv, verde_claro, verde_escuro)
    mascara_inv = cv2.bitwise_not(mascara)
    b, g, r = cv2.split(img)
    rgba = [b, g, r, mascara_inv]
    resultado = cv2.merge(rgba, 4)
    cv2.imwrite(imagem_saida, resultado)
    print(f"Imagem salva em: {imagem_saida}")
remover_fundo('whitelogo.jpg', 'whitelogo.png')