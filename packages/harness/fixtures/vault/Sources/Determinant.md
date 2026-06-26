---
title: "Determinant"
date_created: 2023-11-27
topic: language
source: "https://en.wikisource.org/wiki/1911_Encyclopædia_Britannica/Determinant"
---

# Determinant

DETERMINANT, in mathematics, a function which presents itself in the
solution of a system of simple equations.

1. Considering the equations

                   ax  + by  + cz  = d,
                   a'x + b'y + c'z = d',
                   a"x + b"y + c"z = d",

and proceeding to solve them by the so-called method of cross
multiplication, we multiply the equations by factors selected in such a
manner that upon adding the results the whole coefficient of y becomes =
0, and the whole coefficient of z becomes = 0; the factors in question
are b'c" - b"c', b"c - bc", bc' - b'c (values which, as at once seen,
have the desired property); we thus obtain an equation which contains on
the left-hand side only a multiple of x, and on the right-hand side a
constant term; the coefficient of x has the value

          a(b'c" - b"c') + a'(b"c - bc") + a"(bc' - b'c),

and this function, represented in the form

                         |a,  b,  c |,
                         |a', b', c'|
                         |a", b", c"|

is said to be a determinant; or, the number of elements being 3², it is
called a determinant of the third order. It is to be noticed that the
resulting equation is

                |a,  b,  c | x = |d,  b,  c |
                |a', b', c'|     |d', b', c'|
                |a", b", c"|     |d", b", c"|

where the expression on the right-hand side is the like function with d,
d', d" in place of a, a', a" respectively, and is of course also a
determinant. Moreover, the functions b'c" - b"c', b"c - bc", bc' - b'c
used in the process are themselves the determinants of the second order

                |b', c'|, |b", c"|, |b,  c |.
                |b", c"|  |b,  c |  |b', c'|

We have herein the suggestion of the rule for the derivation of the
determinants of the orders 1, 2, 3, 4, &c., each from the preceding one,
viz. we have

  |a|      = a,

  |a,  b | = a|b'| - a'|b|.
  |a', b'|

  |a,  b,  c | = a|b', c'| + a'|b", c"| + a"|b,  c |,
  |a', b', c'|    |b", c"|     |b , c |     |b', c'|
  |a", b", c"|

  |a,   b  , c  , d  | = a|b',  c',  d' | - a'|b" , c" , d" | +
  |a',  b' , c' , d' |    |b",  c",  d" |     |b"', c"', d"'|
  |a",  b" , c" , d" |    |b"', c"', d"'|     |b  , c  , d  |
  |a"', b"', c"', d"'|

                      + a"|b"', c"', d"'| - a"'|b , c,  d |,
                          |b  , c  , d  |      |b', c', d'|
                          |b' , c' , d' |      |b", c", d"|

and so on, the terms being all + for a determinant of an odd order, but
alternately + and - for a determinant of an even order.

2. It is easy, by induction, to arrive at the general results:--

A determinant of the order n is the sum of the 1.2.3...n products which
can be formed with n elements out of n² elements arranged in the form of
a square, no two of the n elements being in the same line or in the same
column, and each such product having the coefficient ± unity.

The products in question may be obtained by permuting in every possible
manner the columns (or the lines) of the determinant, and then taking
for the factors the n elements in the dexter diagonal. And we thence
derive the rule for the signs, viz. considering the primitive
arrangement of the columns as positive, then an arrangement obtained
therefrom by a single interchange (inversion, or derangement) of two
columns is regarded as negative; and so in general an arrangement is
positive or negative according as it is derived from the primitive
arrangement by an even or an odd number of interchanges. [This implies
the theorem that a given arrangement can be derived from the primitive
arrangement only by an odd number, or else only by an even number of
interchanges,--a theorem the verification of which may be easily
obtained from the theorem (in fact a particular case of the general
one), an arrangement can be derived from itself only by an even number
of interchanges.] And this being so, each product has the sign belonging
to the corresponding arrangement of the columns; in particular, a
determinant contains with the sign + the product of the elements in its
dexter diagonal. It is to be observed that the rule gives as many
positive as negative arrangements, the number of each being = ½ 1.2...n.

The rule of signs may be expressed in a different form. Giving to the
columns in the primitive arrangement the numbers 1, 2, 3 ... n, to
obtain the sign belonging to any other arrangement we take, as often as
a lower number succeeds a higher one, the sign -, and, compounding
together all these minus signs, obtain the proper sign, + or - as the
case may be.

Thus, for three columns, it appears by either rule that 123, 231, 312
are positive; 213, 321, 132 are negative; and the developed expression
of the foregoing determinant of the third order is

           = ab'c" - ab"c' + a'b"c - a'bc" + a"bc' - a"b'c.

3. It further appears that a determinant is a linear function[1] of the
elements of each column thereof, and also a linear function of the
elements of each line thereof; moreover, that the determinant retains
the same value, only its sign being altered, when any two columns are
interchanged, or when any two lines are interchanged; more generally,
when the columns are permuted in any manner, or when the lines are
permuted in any manner, the determinant retains its original value, with
the sign + or - according as the new arrangement (considered as derived
from the primitive arrangement) is positive or negative according to the
foregoing rule of signs. It at once follows that, if two columns are
identical, or if two lines are identical, the value of the determinant
is = 0. It may be added, that if the lines are converted into columns,
and the columns into lines, in such a way as to leave the dexter
diagonal unaltered, the value of the determinant is unaltered; the
determinant is in this case said to be _transposed_.

4. By what precedes it appears that there exists a function of the n²
elements, linear as regards the terms of each column (or say, for
shortness, linear as to each column), and such that only the sign is
altered when any two columns are interchanged; these properties
completely determine the function, except as to a common factor which
may multiply all the terms. If, to get rid of this arbitrary common
factor, we assume that the product of the elements in the dexter
diagonal has the coefficient +1, we have a complete definition of the
determinant, and it is interesting to show how from these properties,
assumed for the definition of the determinant, it at once appears that
the determinant is a function serving for the solution of a system of
linear equations. Observe that the properties show at once that if any
column is = 0 (that is, if the elements in the column are each = 0),
then the determinant is = 0; and further, that if any two columns are
identical, then the determinant is = 0.

5. Reverting to the system of linear equations written down at the
beginning of this article, consider the determinant

                 |ax  + by  + cz  - d , b , c |;
                 |a'x + b'y + c'z - d', b', c'|
                 |a"x + b"y + c"z - d", b", c"|

it appears that this is

  = x|a , b , c | + y|b , b , c | + z|c , b , c | - |d , b , c |;
     |a', b', c'|    |b', b', c'|    |c', b', c'|   |d', b', c'|
     |a", b", c"|    |b", b", c"|    |c", b", c"|   |d", b", c"|

viz. the second and third terms each vanishing, it is

                = x|a , b , c | - |d , b , c |.
                   |a', b', c'|   |d', b', c'|
                   |a", b", c"|   |d", b", c"|

But if the linear equations hold good, then the first column of the
original determinant is = 0, and therefore the determinant itself is = 0;
that is, the linear equations give

                x|a , b , c | - |d , b , c | = 0;
                 |a', b', c'|   |d', b', c'|
                 |a", b", c"|   |d", b", c"|

which is the result obtained above.

We might in a similar way find the values of y and z, but there is a
more symmetrical process. Join to the original equations the new
equation

            [alpha]x + [beta]y + [gamma]z = [delta];

a like process shows that, the equations being satisfied, we have

           |[alpha], [beta], [gamma], [delta]| = 0;
           |   a   ,    b  ,    c   , d      |
           |   a'  ,    b' ,    c'  , d'     |
           |   a"  ,    b" ,    c"  , d"     |

or, as this may be written,

     |[alpha], [beta], [gamma]    | - [delta]| a , b , c | = 0:
     |   a   ,   b   ,    c   , d |          | a', b', c'|
     |   a'  ,   b'  ,    c'  , d'|          | a", b", c"|
     |   a"  ,   b"  ,    c"  , d"|          |           |

which, considering [delta] as standing herein for its value [alpha]x +
[beta]y + [gamma]z, is a consequence of the original equations only: we
have thus an expression for [alpha]x + [beta]y + [gamma]z, an arbitrary
linear function of the unknown quantities x, y, z; and by comparing the
coefficients of [alpha], [beta], [gamma] on the two sides respectively,
we have the values of x, y, z; in fact, these quantities, each
multiplied by

                      |a , b , c |,
                      |a', b', c'|
                      |a", b", c"|

are in the first instance obtained in the forms

       |1             |, |    1         |, |        1     |;
       |a , b , c , d |  |a , b , c , d |  |a , b , c , d |
       |a', b', c', d'|  |a', b', c', d'|  |a', b', c', d'|
       |a", b", c", d"|  |a", b", c", d"|  |a", b", c", d"|

but these are

         = |b , c , d |, - |c , d , a |, |d , a , b |,
           |b', c', d'|    |c', d', a'|  |d', a', b'|
           |b", c", d"|    |c", d", a"|  |d", a", b"|

or, what is the same thing,

         = |b , c , d |, |c , a , d |, |a , b , d |
           |b', c', d'|  |c', a', d'|  |a', b', d'|
           |b", c", d"|  |c", a", d"|  |a", b", d"|

respectively.

6. _Multiplication of two Determinants of the same Order._--The theorem
is obtained very easily from the last preceding definition of a
determinant. It is most simply expressed thus--

              ([alpha], [alpha]', [alpha]"),
                     ([beta],[beta]',[beta]"),
                           ([gamma],[gamma]',[gamma]")
              +---------------------------------------+
  (a , b , c )|          "       "       "            | =
  (a', b', c')|          "       "       "            |
  (a", b", c")|          "       "       "            |

                        = |a , b , c |. |[alpha] , [beta] , [gamma] |,
                          |a', b', c'|  |[alpha]', [beta]', [gamma]'|
                          |a", b", c"|  |[alpha]", [beta]", [gamma]"|

where the expression on the left side stands for a determinant, the
terms of the first line being (a, b, c)([alpha], [alpha]', [alpha]"),
that is, a[alpha] + b[alpha]' + c[alpha]", (a, b, c)([beta], [beta]',
[beta]"), that is, a[beta] + b[beta]' + c[beta]", (a, b, c)([gamma],
[gamma]', [gamma]"), that is a[gamma] + b[gamma]' + c[gamma]"; and
similarly the terms in the second and third lines are the life functions
with (a', b', c') and (a", b", c") respectively.

There is an apparently arbitrary transposition of lines and columns; the
result would hold good if on the left-hand side we had written ([alpha],
[beta], [gamma]), ([alpha]', [beta]', [gamma]'), ([alpha]", [beta]",
[gamma]"), or what is the same thing, if on the right-hand side we had
transposed the second determinant; and either of these changes would, it
might be thought, increase the elegance of the form, but, for a reason
which need not be explained,[2] the form actually adopted is the
preferable one.

To indicate the method of proof, observe that the determinant on the
left-hand side, _qua_ linear function of its columns, may be broken up
into a sum of (3³ =) 27 determinants, each of which is either of some
such form as

         = [alpha][beta][gamma]'|a , a , b |,
                                |a', a', b'|
                                |a", a", b"|


where the term [alpha][beta][gamma]' is not a term of the
[alpha][beta][gamma]-determinant, and its coefficient (as a determinant
with two identical columns) vanishes; or else it is of a form such as

         = [alpha][beta]'[gamma]"|a , b , c |,
                                 |a', b', c'|
                                 |a", b", c"|

that is, every term which does not vanish contains as a factor the
abc-determinant last written down; the sum of all other factors ±
[alpha][beta]'[gamma]" is the [alpha][beta][gamma]-determinant of the
formula; and the final result then is, that the determinant on the
left-hand side is equal to the product on the right-hand side of the
formula.

7. _Decomposition of a Determinant into complementary
Determinants._--Consider, for simplicity, a determinant of the fifth
order, 5 = 2 + 3, and let the top two lines be

                        a , b , c , d , e
                        a', b', c', d', e'

then, if we consider how these elements enter into the determinant, it
is at once seen that they enter only through the determinants of the
second order |a , b |, &c., which can be formed by selecting any two
             |a', b'|
columns at pleasure. Moreover, representing the remaining three lines by

                   a" , b" , c" , d" , e"
                   a"', b"', c"', d"', e"'
                   a"", b"", c"", d"", e""

it is further seen that the factor which multiplies the determinant
formed with any two columns of the first set is the determinant of the
third order formed with the complementary three columns of the second
set; and it thus appears that the determinant of the fifth order is a
sum of all the products of the form

                 = |a , b |  |c" , d" , e" |,
                   |a', b"|  |c"', d"', e"'|
                             |c"", d"", e""|

the sign ± being in each case such that the sign of the term ±
ab'c"d'"e"" obtained from the diagonal elements of the component
determinants may be the actual sign of this term in the determinant of
the fifth order; for the product written down the sign is obviously +.

Observe that for a determinant of the n-th order, taking the
decomposition to be 1 + (n - 1), we fall back upon the equations given
at the commencement, in order to show the genesis of a determinant.

8. Any determinant |a , b | formed out of the elements of the original
                   |a', b'|
determinant, by selecting the lines and columns at pleasure, is termed a
_minor_ of the original determinant; and when the number of lines and
columns, or order of the determinant, is n-1, then such determinant is
called a _first minor_; the number of the first minors is = n², the
first minors, in fact, corresponding to the several elements of the
determinant--that is, the coefficient therein of any term whatever is
the corresponding first minor. The first minors, each divided by the
determinant itself, form a system of elements _inverse_ to the elements
of the determinant.

A determinant is _symmetrical_ when every two elements symmetrically
situated in regard to the dexter diagonal are equal to each other; if
they are equal and opposite (that is, if the sum of the two elements be
= 0), this relation not extending to the diagonal elements themselves,
which remain arbitrary, then the determinant is _skew_; but if the
relation does extend to the diagonal terms (that is, if these are each =
0), then the determinant is _skew symmetrical_; thus the determinants

  |a, h, g|; |    a ,     [nu],  - [mu]|; |     0,      [nu],  - [mu]|
  |h, b, f|  |- [nu],        b,[lambda]|  |- [nu],         0,[lambda]|
  |g, f, c|  |  [mu],-[lambda],      c |  |  [mu],- [lambda],       0|

are respectively symmetrical, skew and skew symmetrical:

The theory admits of very extensive algebraic developments, and
applications in algebraical geometry and other parts of mathematics. For
further developments of the theory of determinants see ALGEBRAIC FORMS.
                                                                (A. CA.)

  9. _History._--These functions were originally known as "resultants,"
  a name applied to them by Pierre Simon Laplace, but now replaced by
  the title "determinants," a name first applied to certain forms of
  them by Carl Friedrich Gauss. The germ of the theory of determinants
  is to be found in the writings of Gottfried Wilhelm Leibnitz (1693),
  who incidentally discovered certain properties when reducing the
  eliminant of a system of linear equations. Gabriel Cramer, in a note
  to his _Analyse des lignes courbes algébriques_ (1750), gave the rule
  which establishes the sign of a product as _plus_ or _minus_ according
  as the number of displacements from the typical form has been even or
  odd. Determinants were also employed by Étienne Bezout in 1764, but
  the first connected account of these functions was published in 1772
  by Charles Auguste Vandermonde. Laplace developed a theorem of
  Vandermonde for the expansion of a determinant, and in 1773 Joseph
  Louis Lagrange, in his memoir on _Pyramids_, used determinants of the
  third order, and proved that the square of a determinant was also a
  determinant. Although he obtained results now identified with
  determinants, Lagrange did not discuss these functions systematically.
  In 1801 Gauss published his _Disquisitiones arithmeticae_, which,
  although written in an obscure form, gave a new impetus to
  investigations on this and kindred subjects. To Gauss is due the
  establishment of the important theorem, that the product of two
  determinants both of the second and third orders is a determinant. The
  formulation of the general theory is due to Augustin Louis Cauchy,
  whose work was the forerunner of the brilliant discoveries made in the
  following decades by Hoëné-Wronski and J. Binet in France, Carl Gustav
  Jacobi in Germany, and James Joseph Sylvester and Arthur Cayley in
  England. Jacobi's researches were published in _Crelle's Journal_
  (1826-1841). In these papers the subject was recast and enriched by
  new and important theorems, through which the name of Jacobi is
  indissolubly associated with this branch of science. The far-reaching
  discoveries of Sylvester and Cayley rank as one of the most important
  developments of pure mathematics. Numerous new fields were opened up,
  and have been diligently explored by many mathematicians.
  Skew-determinants were studied by Cayley; axisymmetric-determinants by
  Jacobi, V. A. Lebesque, Sylvester and O. Hesse, and centro-symmetric
  determinants by W. R. F. Scott and G. Zehfuss. Continuants have been
  discussed by Sylvester; alternants by Cauchy, Jacobi, N. Trudi, H.
  Nagelbach and G. Garbieri; circulants by E. Catalan, W. Spottiswoode
  and J. W. L. Glaisher, and Wronskians by E. B. Christoffel and G.
  Frobenius. Determinants composed of binomial coefficients have been
  studied by V. von Zeipel; the expression of definite integrals as
  determinants by A. Tissot and A. Enneper, and the expression of
  continued fractions as determinants by Jacobi, V. Nachreiner, S.
  Günther and E. Fürstenau. (See T. Muir, _Theory of Determinants_,
  1906).

[1] The expression, a linear function, is here used in its narrowest
sense, a linear function without constant term; what is meant is that
the determinant is in regard to the elements a, a', a", ... of any
column or line thereof, a function of the form Aa + A'a' + A"a" + ...
without any term independent of a, a', a" ...

[2] The reason is the connexion with the corresponding theorem for the
multiplication of two matrices.

## References

- <https://en.wikisource.org/wiki/1911_Encyclopædia_Britannica/Determinant>

#shipbuilding #history
