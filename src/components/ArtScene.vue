<script setup lang="ts">
withDefaults(defineProps<{ kind?: string; hero?: boolean }>(), {
  kind: "garden",
  hero: false,
});
</script>

<template>
  <svg
    v-if="hero"
    viewBox="0 0 660 390"
    fill="none"
    aria-hidden="true"
    class="hero-art"
  >
    <path
      d="M74 275C8 223 82 128 168 131C193 38 355 11 440 85C559 51 642 144 608 225C667 326 475 373 385 347C243 399 148 345 74 275Z"
      fill="#E2EBCB"
    />
    <path
      d="M98 317C173 268 282 297 340 317C416 266 519 278 605 308"
      stroke="#CBD9B3"
      stroke-width="3"
      stroke-linecap="round"
    />
    <path
      d="M148 140C148 92 177 79 187 96C203 126 180 169 167 184"
      fill="#82A17E"
    />
    <path
      d="M157 166C125 156 110 128 126 118C146 108 167 135 173 158"
      fill="#ABC495"
    />
    <path
      d="M165 219L166 139"
      stroke="#52785C"
      stroke-width="5"
      stroke-linecap="round"
    />
    <path
      d="M495 300C499 242 493 180 511 154"
      stroke="#6E9473"
      stroke-width="7"
      stroke-linecap="round"
    />
    <path
      d="M498 239C452 248 441 211 454 201C472 187 499 214 498 239Z"
      fill="#89AC81"
    />
    <path
      d="M503 205C548 208 565 174 549 162C527 148 504 179 503 205Z"
      fill="#A3BD84"
    />
    <path
      d="M503 175C482 166 478 136 494 130C513 122 523 152 503 175Z"
      fill="#77966F"
    />
    <g transform="rotate(-17 244 191)">
      <rect x="208" y="87" width="58" height="196" rx="10" fill="#EEB451" />
      <path d="M208 247H266V278L237 322L208 278Z" fill="#F8D6A8" />
      <path d="M225 304L237 322L249 304Z" fill="#365447" />
      <path d="M222 117V246M251 117V246" stroke="#D99A37" stroke-width="4" />
      <path d="M208 99C208 83 266 83 266 99V115H208Z" fill="#DF8E7C" />
      <path d="M208 116H266V137H208Z" fill="#F8EDCF" />
      <circle cx="227" cy="186" r="3.3" fill="#5B553B" />
      <circle cx="247" cy="186" r="3.3" fill="#5B553B" />
      <path
        d="M230 199Q237 205 244 199"
        stroke="#5B553B"
        stroke-width="3"
        stroke-linecap="round"
      />
    </g>
    <g transform="rotate(10 380 240)">
      <path
        d="M300 226C300 179 328 149 371 149C418 149 448 184 448 232V287C448 310 300 312 300 285Z"
        fill="#FBF4DE"
      />
      <path
        d="M318 164C287 110 309 78 325 97C342 117 339 146 339 154"
        fill="#FBF4DE"
      />
      <path
        d="M388 152C381 94 407 71 417 96C427 122 409 151 409 164"
        fill="#FBF4DE"
      />
      <path
        d="M320 143C310 118 314 108 319 115C326 125 325 134 327 143M400 137C400 113 408 106 408 114L405 141"
        stroke="#E8B4A4"
        stroke-width="7"
        stroke-linecap="round"
      />
      <circle cx="343" cy="208" r="5" fill="#3E5546" />
      <circle cx="392" cy="208" r="5" fill="#3E5546" />
      <path
        d="M360 219L369 223L376 217"
        stroke="#3E5546"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <ellipse cx="329" cy="222" rx="12" ry="7" fill="#EDB5A2" />
      <ellipse cx="409" cy="222" rx="12" ry="7" fill="#EDB5A2" />
      <path
        d="M300 259C312 245 324 246 335 255L411 256C425 246 438 246 448 258V289C448 309 302 310 300 289Z"
        fill="#9BB98D"
      />
      <path
        d="M326 260L318 300M419 259L425 301"
        stroke="#7C9C73"
        stroke-width="4"
      />
      <circle cx="371" cy="280" r="9" fill="#F1D77E" />
      <ellipse
        cx="303"
        cy="252"
        rx="19"
        ry="13"
        transform="rotate(-25 303 252)"
        fill="#FBF4DE"
      />
      <ellipse
        cx="443"
        cy="250"
        rx="18"
        ry="13"
        transform="rotate(24 443 250)"
        fill="#FBF4DE"
      />
    </g>
    <g transform="rotate(15 126 294)">
      <path
        d="M89 294C89 267 158 267 158 294V325C158 343 89 343 89 325Z"
        fill="#DF9D89"
      />
      <ellipse cx="123.5" cy="294" rx="34.5" ry="12" fill="#F1B7A1" />
      <path
        d="M108 294L97 225M123 291L129 215M138 295L154 230"
        stroke="#7D9570"
        stroke-width="10"
        stroke-linecap="round"
      />
      <path
        d="M93 231L90 215M129 220L130 201M154 233L160 216"
        stroke="#E3B75A"
        stroke-width="13"
        stroke-linecap="round"
      />
    </g>
    <path
      d="M503 95C503 79 528 73 531 91C545 74 563 89 552 104L527 125Z"
      fill="#DE9F89"
    />
    <path
      d="M102 73L108 88L123 94L108 100L102 115L96 100L81 94L96 88Z"
      fill="#E5B758"
    />
    <path
      d="M459 52L463 62L473 66L463 70L459 80L455 70L445 66L455 62Z"
      fill="#88A27E"
    />
    <path
      d="M567 258L573 271L587 275L573 280L567 294L563 280L549 275L563 271Z"
      fill="#E3B75A"
    />
    <path
      d="M289 50C303 39 315 41 323 53M569 129L581 121M581 141L594 138M74 217L63 210"
      stroke="#90A782"
      stroke-width="4"
      stroke-linecap="round"
    />
    <circle cx="194" cy="62" r="5" fill="#DC9B87" />
    <circle cx="476" cy="327" r="6" fill="#E8BE64" />
    <circle cx="58" cy="169" r="4" fill="#9DB48D" />
  </svg>
  <svg
    v-else-if="kind === 'space'"
    viewBox="0 0 400 240"
    fill="none"
    aria-hidden="true"
  >
    <path fill="#E6E4F3" d="M0 0H400V240H0z" />
    <circle cx="300" cy="52" r="33" fill="#F4DB96" />
    <circle cx="310" cy="40" r="7" fill="#E8C777" />
    <circle cx="286" cy="59" r="10" fill="#E8C777" />
    <path d="M0 206Q84 170 171 203T400 185V240H0Z" fill="#CCC8E4" />
    <g transform="rotate(25 195 120)">
      <path d="M166 147V94Q192 21 218 94V147Z" fill="#FCFAEE" />
      <path d="M166 95Q192 21 218 95Z" fill="#DF9C8E" />
      <path
        d="M166 124Q141 136 147 166L168 150M218 124Q243 136 237 166L216 150"
        fill="#88A997"
      />
      <circle
        cx="192"
        cy="111"
        r="15"
        fill="#B5D0CE"
        stroke="#779B98"
        stroke-width="5"
      />
      <path d="M178 153Q192 210 206 153" fill="#E6B866" />
      <path d="M185 153Q192 188 199 153" fill="#F6DC98" />
    </g>
    <ellipse
      cx="72"
      cy="103"
      rx="35"
      ry="12"
      transform="rotate(-24 72 103)"
      fill="#B2AFD0"
    />
    <circle cx="72" cy="101" r="21" fill="#C2BDD9" />
    <path d="M39 116L103 88" stroke="#EDEAF6" stroke-width="5" />
    <path
      d="M93 32V48M85 40H101M317 153V171M308 162H326M250 23V35M244 29H256M35 162V174M29 168H41"
      stroke="#A6A1C8"
      stroke-width="3"
      stroke-linecap="round"
    />
    <circle cx="137" cy="65" r="3" fill="#FFF9E8" />
    <circle cx="341" cy="115" r="4" fill="#FFF9E8" />
    <circle cx="276" cy="205" r="4" fill="#FFF9E8" />
  </svg>
  <svg
    v-else-if="kind === 'ocean'"
    viewBox="0 0 400 240"
    fill="none"
    aria-hidden="true"
  >
    <path fill="#DCEEEA" d="M0 0H400V240H0z" />
    <path d="M0 42Q50 23 100 42T200 42T300 42T400 42V0H0Z" fill="#EBF6EE" />
    <path d="M0 216Q87 191 162 215T400 205V240H0Z" fill="#D0DBC0" />
    <path
      d="M94 210Q70 170 84 143M107 211Q129 172 117 153M87 181Q55 180 65 160"
      stroke="#81A994"
      stroke-width="8"
      stroke-linecap="round"
    />
    <path
      d="M299 212V173M299 190L278 180V167M300 180L318 167V151M318 169L335 161"
      stroke="#DFAB99"
      stroke-width="8"
      stroke-linecap="round"
    />
    <path
      d="M151 127C150 84 236 82 257 116L280 98V146L257 132C240 167 159 166 151 127Z"
      fill="#E5BA70"
    />
    <path d="M215 96Q198 126 217 156" stroke="#F4D797" stroke-width="15" />
    <circle cx="175" cy="119" r="4.5" fill="#3E6257" />
    <path
      d="M170 132Q178 138 185 131"
      stroke="#3E6257"
      stroke-width="2.5"
      stroke-linecap="round"
    />
    <path d="M229 149Q223 176 209 161L209 146" fill="#C79C59" />
    <circle cx="141" cy="86" r="9" stroke="#A1CBC2" stroke-width="3" />
    <circle cx="122" cy="60" r="5" stroke="#A1CBC2" stroke-width="3" />
    <circle cx="306" cy="85" r="7" stroke="#A1CBC2" stroke-width="3" />
    <path
      d="M55 93L65 100L78 94L73 109L82 119L66 118L57 131L56 115L42 109L55 104Z"
      fill="#E6B8A0"
    />
  </svg>
  <svg
    v-else-if="kind === 'magic'"
    viewBox="0 0 400 240"
    fill="none"
    aria-hidden="true"
  >
    <path fill="#F5E6DC" d="M0 0H400V240H0z" />
    <path d="M0 207Q103 169 208 210T400 190V240H0Z" fill="#DCE1C5" />
    <path d="M174 122H236L248 207H162Z" fill="#FAF4DE" />
    <path
      d="M129 127C131 71 176 39 205 40C248 40 282 80 286 123C267 144 154 147 129 127Z"
      fill="#DFA08D"
    />
    <ellipse
      cx="179"
      cy="83"
      rx="17"
      ry="12"
      transform="rotate(-20 179 83)"
      fill="#F8E3C5"
    />
    <ellipse
      cx="242"
      cy="106"
      rx="16"
      ry="11"
      transform="rotate(17 242 106)"
      fill="#F8E3C5"
    />
    <circle cx="211" cy="56" r="9" fill="#F8E3C5" />
    <path d="M188 208V176Q204 151 221 176V208Z" fill="#9DB49A" />
    <circle cx="212" cy="187" r="3" fill="#597663" />
    <path d="M96 211V172M306 209V173" stroke="#81A17B" stroke-width="4" />
    <path d="M78 174Q77 146 96 145Q116 146 115 173Z" fill="#E8BC75" />
    <path d="M285 178Q285 150 306 150Q327 150 326 178Z" fill="#B3A8CA" />
    <path
      d="M73 62L77 74L90 79L77 83L73 96L68 83L56 79L68 74M318 48L322 58L333 61L322 65L318 76L315 65L304 61L315 58"
      fill="#D4B175"
    />
    <path d="M343 124Q362 112 369 128Q359 142 343 124Z" fill="#A4B9A1" />
    <path d="M56 133Q42 120 32 137Q40 149 56 133Z" fill="#B8C6AA" />
  </svg>
  <svg v-else viewBox="0 0 400 240" fill="none" aria-hidden="true">
    <path fill="#EAF0D9" d="M0 0H400V240H0z" />
    <circle cx="319" cy="53" r="23" fill="#F3D786" />
    <path d="M0 185Q100 140 210 184T400 171V240H0Z" fill="#CDDDB8" />
    <path d="M0 220Q100 180 205 219T400 204V240H0Z" fill="#B4CBA1" />
    <path
      d="M112 193V69M112 120L83 100M112 147L143 121"
      stroke="#8F9C71"
      stroke-width="8"
      stroke-linecap="round"
    />
    <path
      d="M112 49C70 37 51 84 78 104C54 136 95 153 114 133C143 157 172 122 151 102C179 70 142 36 112 49Z"
      fill="#90B28A"
    />
    <path
      d="M220 204C211 191 215 160 231 157C225 130 231 109 242 113C252 117 246 145 246 151C253 129 269 119 274 128C279 138 260 159 260 159C280 168 280 200 264 206Z"
      fill="#FCF7E8"
    />
    <circle cx="242" cy="175" r="3" fill="#546A50" />
    <circle cx="260" cy="175" r="3" fill="#546A50" />
    <path
      d="M246 184L251 187L256 183"
      stroke="#546A50"
      stroke-width="2"
      stroke-linecap="round"
    />
    <path
      d="M302 205V160M323 213V180M174 209V185"
      stroke="#81A373"
      stroke-width="3"
    />
    <g fill="#E7AD98">
      <circle cx="295" cy="153" r="7" />
      <circle cx="307" cy="151" r="7" />
      <circle cx="311" cy="161" r="7" />
      <circle cx="299" cy="165" r="7" />
    </g>
    <circle cx="303" cy="157" r="5" fill="#F6DA8C" />
    <g fill="#F6DA8C">
      <circle cx="317" cy="176" r="6" />
      <circle cx="326" cy="174" r="6" />
      <circle cx="330" cy="182" r="6" />
      <circle cx="320" cy="185" r="6" />
    </g>
    <circle cx="323" cy="180" r="4" fill="#BA9769" />
    <path
      d="M174 179C159 161 154 179 174 184C195 170 182 160 174 179Z"
      fill="#EEE3B0"
    />
    <path
      d="M199 66Q211 43 223 64Q232 43 244 60Q250 79 230 81H210Q194 79 199 66Z"
      fill="#FAFAED"
    />
    <path d="M48 178Q28 158 26 174Q29 189 48 178Z" fill="#98AF80" />
  </svg>
</template>
