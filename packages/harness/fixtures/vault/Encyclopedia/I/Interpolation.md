---
title: "Interpolation"
date_created: 2023-05-13
topic: history
type: article
id: 42-3958
---

# Interpolation

INTERPOLATION (from Lat. _interpolare_, to alter, or insert something
fresh, connected with _polire_, a polish), in mathematics, the process
of obtaining intermediate terms of a series of which particular terms
only are given. The cubes, for instance, shown in the second column of
the accompanying table, may

  +-------+----------------+
  |Number.| Cube of Number.|
  +-------+----------------+
  |   0   |        0       |
  |   1   |        1       |
  |   2   |        8       |
  |   3   |       27       |
  |   4   |       64       |
  |   5   |      125       |
  |   6   |      216       |
  |   .   |       .        |
  |   .   |       .        |
  |   .   |       .        |
  +-------+----------------+

be regarded as terms of a series, and the cube of a fractional number,
not exceeding the last number in the first column, may be found by
interpolation. The process of obtaining the cube of a number exceeding
the last number in the first column would be _extrapolation_; the
formulae which apply to interpolation apply in theory to extrapolation,
but in practice special precautions as to accuracy are necessary. The
present article deals only with interpolation.

The term is usually limited to those cases in which there are two
quantities, x and u, which are so related that when x has any arbitrary
value, lying perhaps between certain limits, the value of u is
determinate. There is a given series of associated values of u and of x,
and interpolation consists in determining the value of u for any
arbitrary value of x, or the value of x for any arbitrary value of u,
lying between two of the values in the series. Either of the two
quantities may be regarded as a function of the other; it is convenient
to treat one, x, as the "independent variable," the other, u, being
treated as the "dependent variable," i.e. as a function of x. If, as is
usually the case, the successive values of one of the quantities proceed
by a constant increment, this quantity is to be regarded as the
independent variable. The two series of values may be tabulated, those
of x being placed in a column (or row), and those of u in a parallel
column (or row); u is then said to be _tabulated in terms of_ x. The
independent variable x is called the _argument_, and the dependent
variable u is called the _entry_. Interpolation, in the ordinary sense,
consists in determining the value of u for a value of x intermediate
between two values appearing in the table. This may be described as
_direct interpolation_, to distinguish it from _inverse interpolation_,
which consists in determining the value of x for a value of u
intermediate between two in the table. The methods employed can be
extended to cases in which the value of u depends on the values of two
or more independent quantities x, y,...

  In the ordinary case we may regard the values of x as measured along a
  straight line OX from a fixed point O, so that to any value of x there
  corresponds a point on the line. If we represent the corresponding
  value of u by an ordinate drawn from the line, the extremities of all
  such ordinates will lie on a curve which will be the graph of u with
  regard to x. Interpolation therefore consists in determining the
  length of the ordinate of a curve occupying a particular position,
  when the lengths of ordinates occupying certain specified positions
  are known. If u is a function of two variables, x and y, we may
  similarly represent it by the ordinate of a surface, the position of
  the ordinate being determined by the values of x and of y jointly.

  The series or tables to which interpolation has to be applied may for
  convenience be regarded as falling into two main groups. The first
  group comprises mathematical tables, i.e. tables of mathematical
  functions; in the case of such a table the value of the function u for
  each tabulated value of x is calculated to a known degree of accuracy,
  and the degree of accuracy of an interpolated value of u can be
  estimated. The second group comprises tables of values which are found
  experimentally, e.g. values of a physical quantity or of a statistical
  ratio; these values are usually subject to certain "errors" of
  observation or of random selection (see PROBABILITY). The methods of
  interpolation are usually the same in the two groups of cases, but
  special considerations have to be taken into account in the second
  group. The line of demarcation of the two groups is not absolutely
  fixed; the tables used by actuaries, for instance, which are of great
  importance in practical life, are based on statistical observations,
  but the tables formed directly from the observations have been
  "smoothed" so as to obtain series which correspond in form to the
  series of values of mathematical functions.

  It must be assumed, at any rate in the case of a mathematical
  function, that the "entry" u varies continuously with the "argument"
  x, i.e. that there are no sudden breaks, changes of direction, &c., in
  the curve which is the graph of u.

  Various methods of interpolation are described below. The simplest is
  that which uses the _principle of proportional parts_; and
  mathematical tables are usually arranged so as to enable this method
  to be employed. Where this is not possible, the methods are based
  either on the use of Taylor's Theorem, which gives a formula involving
  differential coefficients (see INFINITESIMAL CALCULUS), or on the
  properties of finite differences (see DIFFERENCES, CALCULUS OF).
  Taylor's Theorem can only be applied directly to a known mathematical
  function; but it can be applied indirectly, by means of finite
  differences, in various cases where the form of the function
  expressing u in terms of x is unknown; and even where the form of this
  function is known it is sometimes more convenient to determine the
  differential coefficients by means of the differences than to
  calculate them directly from their mathematical expressions. Finally,
  there are cases where we cannot even employ finite-difference formulae
  directly. In these cases we must adopt some special method; e.g. we
  may instead of u tabulate some function of u, such as its logarithm,
  which is found to be amenable to ordinary processes, then determine
  the value of this function corresponding to the particular value of x,
  and thence determine the corresponding value of u itself.

  In considering methods of interpolation, it will be assumed, unless
  the contrary is stated, that the values of x proceed by a constant
  increment, which will be denoted by h.

  In order to see what method is to be employed, it is usually necessary
  to arrange the given series of values of u in the form of a table, as
  explained above, and then to take the successive _differences_ of u.
  The differences of the successive values of u are called its _first
  differences_; these form a new series, the first differences of which
  are the _second differences_ of u; and so on. The systems of notation
  of the differences are explained briefly below. For the fuller
  discussion, reference should be made to DIFFERENCES, CALCULUS OF.


  I. INTERPOLATION FROM MATHEMATICAL TABLES

  A. Direct Interpolation.

  1. _Interpolation by First Differences._--The simplest cases are those
  in which the first difference in u is constant, or nearly so. For
  example:--

    _Example_ 1.--(u = log_10 x).   _Example_ 2.--(u = log_10 x).

    +-------+--------+---------+     +------+--------+---------+
    |   x.  |    u.  |1st Diff.|     |  x.  |   u.   |1st Diff.|
    +-------+--------+---------+     +------+--------+---------+
    |       |        |    +    |     |      |        |    +    |
    | 4.341 |.6375898|         |     | 7.40 | .86923 |         |
    |       |        |   1000  |     |      |        |    59   |
    | 4.342 |.6376898|         |     | 7.41 | .86982 |         |
    |       |        |   1000  |     |      |        |    58   |
    | 4.343 |.6377898|         |     | 7.42 | .87040 |         |
    |       |        |   1000  |     |      |        |    59   |
    | 4.344 |.6378898|         |     | 7.43 | .87099 |         |
    |       |        |   1000  |     |      |        |    58   |
    | 4.345 |.6379898|         |     | 7.44 | .87157 |         |
    +-------+--------+---------+     +------+--------+---------+

  In Example 1 the first difference of u corresponding to a difference
  of h [equivalent] .001 in x is .0001000; but, since we are working
  throughout to seven places of decimals, it is more convenient to write
  it 1000. This system of ignoring the decimal point in dealing with
  differences will be adopted throughout this article. To find u for an
  intermediate value of x we assume the principle of proportional parts,
  i.e. we assume that the difference in u is proportional to the
  difference in x. Thus for x = 4.342945 the difference in u is .945 of
  1000 = 945, so that u is .6376898 + .0000945 = .6377843. For x =
  4.34294482 the difference in u would be 944.82, so that the value of u
  would apparently be .6376898 + .000094482 = .637784282. This, however,
  would be incorrect. It must be remembered that the values of u are
  only given "correct to seven places of decimals," i.e. each tabulated
  value differs from the corresponding true value by a _tabular error_
  which may have any value up to [+-] 1/2 of .0000001; and we cannot
  therefore by interpolation obtain a result which is correct to nine
  places. If the interpolated value of u has to be used in calculations
  for which it is important that this value should be as accurate as
  possible, it may be convenient to retain it temporarily in the form
  .6376898 + 944 82 = .6377842 82 or .6376898 + 944^82 = .6377842^82;
  but we must ultimately return to the seven-place arrangement and write
  it as .6377843. The result of interpolation by first difference is
  thus usually subject to two inaccuracies, the first being the tabular
  error of u itself, and the second being due to the necessity of
  adjusting the final figure of the added (proportional) difference. If
  the tabulated values are correct to seven places of decimals, the
  interpolated value, with the final figure adjusted, will be within
  .0000001 of its true value.

  In Example 2 the differences do not at first sight appear to run
  regularly, but this is only due to the fact that the final figure in
  each value of u represents, as explained in the last paragraph, an
  approximation to the true value. The general principle on which we
  proceed is the same; but we use the actual difference corresponding to
  the interval in which the value of x lies. Thus for x = 7.41373 we
  should have u = .86982 + (.373 of 58) = .87004; this result being
  correct within .00001.

  2. _Interpolation by Second Differences._--If the consecutive first
  differences of u are not approximately equal, we must take account of
  the next order of differences. For example:--

    _Example 3._--(u = log_10 x).

    +-----+-------+---------+---------+
    |  x. |   u.  |1st Diff.|2nd Diff.|
    +-----+-------+---------+---------+
    | 6.0 |.77815 |         |         |
    |     |       |  +718   |         |
    | 6.1 |.78533 |         |   -12   |
    |     |       |  +706   |         |
    | 6.2 |.79239 |         |   -11   |
    |     |       |  +695   |         |
    | 6.3 |.79934 |         |   -11   |
    |     |       |  +684   |         |
    | 6.4 |.80618 |         |   -11   |
    |             |  +673   |         |
    | 6.5 |.81291 |         |         |
    +-----+-------+---------+---------+

  In such a case the _advancing-difference_ formula is generally used.
  The notation is as follows. The series of values of x and of u are
  respectively x0, x1, x2, ... and u0, u1, u2, ... ; and the successive
  differences of u are denoted by [Delta]u, [Delta]^2u, ... Thus
  [Delta]u0 denotes u1 - u0, and [Delta]^2u0 denotes [Delta]u1 -
  [Delta]u0 = u2 - 2u1 + u0. The value of x for which u is sought is
  supposed to lie between x0 and x1. If we write it equal to x0 +
  [theta](x1 - x0) = x0 + [theta]h, so that [theta] lies between 0 and
  1, we may denote it by x_([theta]), and the corresponding value of u
  by u_([theta]). We have then

                                       [theta] (1 - [theta])
    u[theta] = u0 + [theta][Delta]u0 - --------------------- [Delta]^2u0
                                                 2!

        [theta] (1 - [theta]) (2 - [theta])
      + ----------------------------------- [Delta]^3u0 - ...  (1).
                         3!

  Tables of the values of the coefficients of [Delta]^2u0 and [Delta]^3u0
  to three places of decimals for various values of [theta] from 0 to 1
  are given in the ordinary collections of mathematical tables; but the
  formula is not really convenient if we have to go beyond [Delta]^2u0,
  or if [Delta]^2u0 itself contains more than two significant figures.

  To apply the formula to Example 3 for x = 6.277, we have [theta] =
  .77, so that u_([theta]) = .79239 + (.77 of 695) - (.089 of -11) =
  .79239 + 535 15 + 0 98 = .79775.

  Here, as elsewhere, we use two extra figures in the intermediate
  calculations, for the purpose of adjusting the final figure in the
  ultimate result.

  3. _Taylor's Theorem._--Where differences beyond the second are
  involved, Taylor's Theorem is useful. This theorem (see INFINITESIMAL
  CALCULUS) gives the formula

                                      [theta]^2      [theta]^3
    u_([theta]) = u0 + c1[theta] + c2 --------- + c3 --------- + ...  (2),
                                          2!             3!

  where, c1, c2, c3, ... are the values for x = x0 of the first, second,
  third, ... differential coefficients of u with regard to x. The values
  of c1, c2, ... can occasionally be calculated from the analytical
  expressions for the differential coefficients of u; but more generally
  they have to be calculated from the tabulated differences. For this
  purpose _central-difference_ formulae are the best. If we write

    [mu][delta]u0  = (1/2)([Delta]u0 + [Delta]u_(-1))          \
    [delta]^2u0  = [Delta]^2u_(-1)                              |  (3),
    [mu][delta]^3u0 = (1/2)([Delta]^3u_(-1) + [Delta]^3u_(-2))  |
      &c.                                                      /

  so that, if (as in SS 1 and 2) each difference is placed opposite the
  space between the two quantities of which it is the difference, the
  expressions [delta]^2u0, [delta]^4u0, ... denote the differences of
  even order in a horizontal line with u0, and [mu][delta]u0,
  [mu][delta]^3u0, ... denote the means of the differences of odd order
  immediately below and above this line, then (see DIFFERENCES,
  CALCULUS OF) the values of c1, c2, . . . are given by

    c1 = [mu][delta]u0 - (1/6)[mu][delta]^3u0 + (1/30)[mu][delta]^5u0                   \
           - (1/140)[mu][delta]^7u0 + ...                                                |
    c2 = [delta]^2u0 - (1/12)[delta]^4u0 + (1/90)[delta]^6u0 - (1/560)[delta]^8u0 + ...  |
    c3 = [mu][delta]^3u0 - (1/4)[mu][delta]^5u0 + (7/120)[mu][delta]^7u0 - ...           |
    c4 = [delta]^4u0 - (1/6)[delta]^6u0 + (7/240)[delta]^8u0 - ...                       |
    c5 = [mu][delta]^5u0 - (1/3)[mu][delta]^7u0 + ...                                    | (4).
    c6 = [delta]^6u0 - (1/4)[delta]^8u0 + ...                                            |
      .          .                                                                       |
      .          .                                                                       |
      .          .                                                                      /

  If a calculating machine is used, the formula (2) is most conveniently
  written

    u_([theta]) = u0 + P1[theta]      \
    P1          = c1 + (1/2)P2[theta]  |
    P2          = c2 + (1/3)P3[theta]  |  (5).
     .            .                    |
     .            .                    |
     .            .                   /

  Using [theta] as the multiplicand in each case, the successive
  expressions ... P3, P2, P1, u_([theta]) are easily calculated.

  As an example, take u = tan x to five places of decimals, the values
  of x proceeding by a difference of 1 deg. It will be found that the
  following is part of the table:--

    _Example_ 4.--(u = tan x).

    +--------+--------+---------+---------+---------+---------+
    |   x.   |   u.   |1st Diff.|2nd Diff.|3rd Diff.|4th Diff.|
    +--------+--------+---------+---------+---------+---------+
    |        |        |    +    |    +    |    +    |    +    |
    | 65 deg.| 2.14451|         |   732   |         |    16   |
    |        |        |  10153  |         |    96   |         |
    | 66 deg.| 2.24604|         |   828   |         |    19   |
    |        |        |  10981  |         |   115   |         |
    | 67 deg.| 2.35585|         |   943   |         |    18   |
    +--------+--------+---------+---------+---------+---------+

  To find u for x = 66 deg. 23', we have [theta] = 23/60 = .3833333. The
  following shows the full working: in actual practice it would be
  abbreviated. The operations commence on the right-hand side. It will
  be noticed that two extra figures are retained throughout.

                   u0.                 [mu][delta]u0.              [delta]^2u0.         [mu][delta]^3u0. [delta]^4u0.

                 2.24604                   +10567^00                   +828^00                   +105^50       +19^00
                                           -   17^58                   -  1^58
                                           ---------                   -------                 ---------       ------
                                      c1 = +10549^42              c2 = +826^42              c3 = +105^50  c4 = +19^00
    P1[theta] = +4105^67  (1/2)P2[theta] = +  161^02  (1/3)P3[theta] = + 13^71  (1/8)c4[theta] = +  1^82
                --------                   ---------                   -------                   -------
    u_[theta] =  2.28710              P1 = +10710^44              P2 = +840^13              P3 = +107^32

  The value 2.2870967, obtained by retaining the extra figures, is
  correct within .7 of .00001 (S 8), so that 2.28710 is correct within
  .00001 1.

  In applying this method to mathematical tables, it is desirable, on
  account of the tabular error, that the differences taken into account
  in (4) should end with a difference of even order. If, e.g. we use
  [mu][delta]^3u0 in calculating c1 and c3, we ought also to use
  [delta]^4u0 for calculating c2 and c4, even though the term due to
  [delta]^4u0 would be negligible if [delta]^4u0 were known exactly.

  4. _Geometrical and Algebraical Interpretation._--In applying the
  principle of proportional parts, in such a case as that of Example 1,
  we in effect treat the graph of u as a straight line. We see that the
  extremities of a number of consecutive ordinates lie approximately in
  a straight line: i.e. that, if the values are correct within
  [+-](1/2)[rho], a straight line passes through points which are within
  a corresponding distance of the actual extremities of the ordinates;
  and we assume that this is true for intermediate ordinates.
  Algebraically we treat u as being of the form A + Bx, where A and B
  are constants determined by the values of u at the extremities of the
  interval through which we interpolate. In using first and second
  differences we treat u as being of the form A + Bx + Cx^2; i.e. we
  pass a parabola (with axis vertical) through the extremities of three
  consecutive ordinates, and consider that this is the graph of u, to
  the degree of accuracy given by the data. Similarly in using
  differences of a higher order we replace the graph by a curve whose
  equation is of the form u = A + Bx + Cx^2 + Dx^3 + ... The various
  forms that interpolation-formulae take are due to the various
  principles on which ordinates are selected for determining the values
  of A, B, C ...


  B. _Inverse Interpolation._

  5. To find the value of x when u is given, i.e. to find the value of
  [theta] when u_([theta]) is given, we use the same formula as for
  direct interpolation, but proceed (if differences beyond the first are
  involved) by successive approximation. Taylor's Theorem, for instance,
  gives

                                            [theta]
    [theta] = (u_[theta] - u0) / (c1 + c2 + ------- + ...)
                                               2!

            = (u_[theta] - u0) / P1  (6),

  We first find an approximate value for [theta]: then calculate P1, and
  find by (6) a more accurate value of [theta]; then, if necessary,
  recalculate P1, and thence [theta], and so on.


  II. CONSTRUCTION OF TABLES BY SUBDIVISION OF INTERVALS

  6. When the values of u have been tabulated for values of x proceeding
  by a difference h, it is often desirable to deduce a table in which
  the differences of x are h/n, where n is an integer.

  If n is even it may be advisable to form an intermediate table in
  which the intervals are (1/2)h. For this purpose we have

    u_(1/2) = (1/2)(U0 + U1)  (7),

  where

    U = u - (1/8)[delta]^2u + (3/128)[delta]^4u - (5/1024)[delta]^6u + ...

    = u - (1/8)[[delta]^2u - (3/16){[delta]^4u - (5/24)([delta]^6u - ...)}]  (8).

  The following is an example; the data are the values of tan x to five
  places of decimals, the interval in x being 1 deg. The differences of
  odd order are omitted for convenience of printing.

    _Example 5._

    +--------+---------+-----------+-----------+-----------+------------+------------+-------------+
    |        |  u [eq] |           |           |           |            |u = mean of |             |
    |    x.  |  tan x. |[delta]^2u.|[delta]^4u.|[delta]^6u.|      U.    |values of U.|      x.     |
    +--------+---------+-----------+-----------+-----------+------------+------------+-------------+
    |        |         |     +     |     +     |     +     |            |            |             |
    | 73 deg.| 3.27085 |   2339    |    100    |     5     | 3.26794 95 |            |             |
    |        |         |           |           |           |            |   3.37594  | 73(1/2) deg.|
    | 74 deg.| 3.48741 |   2808    |    132    |    23     | 3.48392 98 |            |             |
    |        |         |           |           |           |            |   3.60588  | 74(1/2) deg.|
    | 75 deg.| 3.73205 |   3409    |    187    |    18     | 3.72783 17 |            |             |
    |        |         |           |           |           |            |   3.86671  | 75(1/2) deg.|
    | 76 deg.| 4.01078 |   4197    |    260    |    51     | 4.00559 22 |            |             |
    |        |         |           |           |           |            |   4.16530  | 76(1/2) deg.|
    | 77 deg.| 4.33148 |   5245    |    384    |    64     | 4.32501 07 |            |             |
    +--------+---------+-----------+-----------+-----------+------------+------------+-------------+

  If a new table is formed from these values, the intervals being 1/2
  deg., it will be found that differences beyond the fourth are
  negligible.

  To subdivide h into smaller intervals than (1/2)h, various methods may
  be used. One is to calculate the sets of quantities which in the new
  table will be the successive differences, corresponding to u0, u1, ...
  and to find the intermediate terms by successive additions. A better
  method is to use a formula due to J. D. Everett. If we write [phi] = 1
  - [theta], Everett's formula is, in its most symmetrical form,

                              ([theta] + 1)[theta]([theta] - 1)
    u_([theta]) = [theta]u1 + ---------------------------------[delta]^2u1
                                              3!

        ([theta] + 2)([theta] + 1)[theta]([theta] - 1)([theta] - 2)
      + -----------------------------------------------------------[delta]^4u1 + ...

                  ([phi] + 1)[phi]([phi] - 1)
      + [phi]u0 + ---------------------------[delta]^2u0
                              3!

        ([phi] + 2)([phi] + 1)[phi]([phi] - 1)([phi] - 2)
      + -------------------------------------------------[delta]^4u0 + ...  (9).
                                 5!

  For actual calculations a less symmetrical form may be used. Denoting

    ([theta] + 1)[theta]([theta] - 1)
    ---------------------------------[delta]^2u1
                    3!

        ([theta] + 2)([theta] + 1)[theta]([theta] - 1)([theta] - 2)
      + -----------------------------------------------------------[delta]^4u1 + ... (10)
                                      5!

  by _([theta])V1, we have, for interpolation between u0 and u1,

    u_([theta]) = u0 + [theta][Delta]u0 + _([theta])V1 + _(1 - [theta])V0  (11),

  the successive values of [theta] being 1/n, 2/n, ... (n-1)/n. For
  interpolation between u1 and u2 we have, with the same succession of
  values of [theta],

    u_(1+[theta]) = u1 + _([theta])V1, V2 + _(1-[theta])V1  (12).

  The values of _(1-[theta])V1 in (12) are exactly the same as those of
  ([theta])V1 in (11), but in the reverse order. The process is
  therefore that (i.) we find the successive values of u0 +
  [theta][Delta]u0, &c., i.e. we construct a table, with the required
  intervals of x, as if we had only to take first differences into
  account; (ii.) we construct, in a parallel column, a table giving the
  values of _([theta])V1, &c.; (iii.) we repeat these latter values,
  placing the set belonging to each interval h in the interval next
  following it, and writing the values in the reverse order; and (iv.)
  by adding horizontally we get the final values for the new table.

  As an example, take the values of tan x by intervals of 1/2 deg. in x,
  as found above (Ex. 5). The first diagram below is a portion of this
  table, with the differences, and the second shows the calculation of
  the terms of (11) so as to get a table in which the intervals are 0.1
  of 1 deg. The last column but one in the second diagram is introduced
  for convenience of calculation.

    _Example 6._

    +---------+-----------+---------+-----------+-----------+-----------+
    |    x.   | u = tan x.|[delta]u.|[delta]^2u.|[delta]^3u.|[delta]^4u.|
    +---------+-----------+---------+-----------+-----------+-----------+
    |         |           |    +    |     +     |     +     |     +     |
    |         |           |  11147  |           |    62     |           |
    | 74 deg.0|  3.48741  |         |    700    |           |     8     |
    |         |           |  11847  |           |    70     |           |
    | 74 deg.5|  3.60588  |         |    770    |           |     9     |
    |         |           |  12617  |           |    79     |           |
    +---------+-----------+---------+-----------+-----------+-----------+

    +----------+------------------+--------------+----------------+----------------+---------+
    |          |       u0 +       |              |                | _([theta])V1 + |         |
    |     x.   | [theta][Delta]u0.| _([theta])V1.| _(1-[theta])V0.| _(1-[theta])V0.|    u.   |
    +----------+------------------+--------------+----------------+----------------+---------+
    | 73 deg.6 |        .         |    -22 35    |       .        |       .        |    .    |
    | 73 deg.7 |        .         |    -39 11    |       .        |       .        |    .    |
    | 73 deg.8 |        .         |    -44 71    |       .        |       .        |    .    |
    | 73 deg.9 |        .         |    -33 54    |       .        |       .        |    .    |
    | 74 deg.0 |    3.48741 00    |              |                |                | 3.48741 |
    | 74 deg.1 |    3.51110 40    |    -24 58    |     -33 54     |     -58 12     | 3.51052 |
    | 74 deg.2 |    3.53479 80    |    -43 02    |     -44 71     |     -87 73     | 3.53392 |
    | 74 deg.3 |    3.55849 20    |    -49 18    |     -39 11     |     -88 29     | 3.55761 |
    | 74 deg.4 |    3.58218 60    |    -36 89    |     -22 35     |     -59 24     | 3.58159 |
    | 74 deg.5 |    3.60588 00    |              |                |                | 3.60588 |
    +----------+------------------+--------------+----------------+----------------+---------+

  The following are the values of the coefficients of u1, [delta]^2u1,
  [delta]^4u1, and [delta]^6u1 in (9) for certain values of n. For
  calculating the four terms due to [delta]^2u1 in the case of n = 5 it
  should be noticed that the third term is twice the first, the fourth
  is the mean of the first and the third, and the second is the mean of
  the third and the fourth. In table 3, and in the last column of table
  2, the coefficients are corrected in the last figure.

    TABLE 1.--n = 5.

    +------+---------------+---------------+--------------------------+
    |co. u.|co. [delta]^2u.|co. [delta]^4u.|      co. [delta]^6u.     |
    +------+---------------+---------------+--------------------------+
    |   +  |       -       |       +       |            -             |
    |  .2  |     .032      |    .006336    | .00135168 = 1/740 approx.|
    |  .4  |     .056      |    .010752    | .00226304 = 1/442    "   |
    |  .6  |     .064      |    .011648    | .00239616 = 1/417    "   |
    |  .8  |     .048      |    .008064    | .00160512 = 1/623    "   |
    +------+---------------+---------------+--------------------------+

    TABLE 2.--n = 10.

    +------+---------------+---------------+---------------+
    |co. u.|co. [delta]^2u.|co. [delta]^4u.|co. [delta]^6u.|
    +------+---------------+---------------+---------------+
    |   +  |       -       |       +       |       -       |
    |  .1  |     .0165     |   .00329175   |  .000704591   |
    |  .2  |     .0320     |   .00633600   |  .001351680   |
    |  .3  |     .0455     |   .00889525   |  .001887064   |
    |  .4  |     .0560     |   .01075200   |  .002263040   |
    |  .5  |     .0625     |   .01171875   |  .002441406   |
    |  .6  |     .0640     |   .01164800   |  .002396160   |
    |  .7  |     .0595     |   .01044225   |  .002115799   |
    |  .8  |     .0480     |   .00806400   |  .001605120   |
    |  .9  |     .0285     |   .00454575   |  .000886421   |
    +------+---------------+---------------+---------------+

    TABLE 3.--n = 12.

    +------+---------------+---------------+---------------+
    |co. u.|co. [delta]^2u.|co. [delta]^4u.|co. [delta]^6u.|
    +------+---------------+---------------+---------------+
    |  +   |       -       |      +        |       -       |
    | 1/12 |   .013792438  |  .002753699   |  .000589623   |
    | 2/12 |   .027006173  |  .005363726   |  .001145822   |
    | 3/12 |   .039062500  |  .007690430   |  .001636505   |
    | 4/12 |   .049382716  |  .009602195   |  .002032211   |
    | 5/12 |   .057388117  |  .010979463   |  .002307357   |
    | 6/12 |   .062500000  |  .011718750   |  .002441406   |
    | 7/12 |   .064139660  |  .011736667   |  .002419911   |
    | 8/12 |   .061728395  |  .010973937   |  .002235432   |
    | 9/12 |   .054687500  |  .009399414   |  .001888275   |
    |10/12 |   .042438272  |  .007014103   |  .001387048   |
    |11/12 |   .024402006  |  .003855178   |  .000748981   |
    +------+---------------+---------------+---------------+


  III. GENERAL OBSERVATIONS

  7. _Derivation of Formulae._--The advancing-difference formula (1) may
  be written, in the symbolical notation of finite differences,

    u_[theta] = (1 + [Delta])^([theta])u0 = E^([theta])u0  (13);

  and it is an extension of the theorem that if n is a positive integer

                            n(n - 1)
    u_n = u0 + n[Delta]u0 + --------[Delta]^2u0 + ...  (14),
                               2!

  the series being continued until the terms vanish. The formula (14) is
  identically true: the formula (13) or (1) is only formally true, but
  its applicability to concrete cases is due to the fact that the series
  in (1), when taken for a definite number of terms, differs from the
  true value of u_([theta]) by a "remainder" which in most cases is very
  small when this definite number of terms is properly chosen.

  Everett's formula (9), and the central-difference formula obtained by
  substituting from (4) in (2), are modifications of a standard formula

                                             [theta]([theta] - 1)
    u_[theta] = u0 + [theta][delta]u_(1/2) + --------------------[delta]^2u0 +
                                                      2!

      ([theta] + 1)[theta]([theta] - 1)
      ----------------------------------[delta]^3u_(1/2) +
                       3!


      ([theta] + 1)[theta]([theta] - 1)([theta] - 2)
      ----------------------------------------------[delta]^4u0 + ...  (15)
                            4!

  which may similarly be regarded as an extension of the theorem that,
  if n is a positive integer,

                                 n(n - 1)              (n + 1)n(n - 1)
    u_n = u0 + n[delta]u_(1/2) + --------[delta]^2u0 + ---------------[delta]^3u_(1/2) + ... (16).
                                    2!                       3!

  There are other central-difference formulae besides those mentioned
  above; the general symbolical expression is

    u_[theta] = (cosh [theta]hD + sinh [theta]hD)u0  (17),

  where

    cosh (1/2)hD = [mu], sinh (1/2)hD = (1/2)[delta]  (18).

  8. _Comparative Accuracy._--Central-difference formulae are usually
  more accurate than advancing-difference formulae, whether we consider
  the inaccuracy due to omission of the "remainder" mentioned in the
  last paragraph or the error due to the approximative character of the
  tabulated values. The latter is the more important. If each tabulated
  value of u is within [+-](1/2)[rho] of the corresponding true value,
  and if the differences used in the formulae are the tabular
  differences, i.e. the actual successive differences of the tabulated
  values of u, then the ratio of the limit of error of u_([theta]), as
  calculated from the first r terms of the series in (1), to (1/2)[rho]
  is the sum of the first r terms of the series

    1 + o + [theta](1 - [theta]) + [theta](1 - [theta])(2 - [theta]) +
     (7/12)[theta](1 - [theta])(2 - [theta])(3 - [theta]) +
     (1/4)[theta](1 - [theta])(2 - [theta])(3 - [theta])(4 - [theta]) +
     (31/360)[theta](1 - [theta])...(5 - [theta])+ ...,

  while the corresponding ratio for the use of differences up to
  [delta]^(2p)u0 inclusive in (4) or up to [delta]^(2p)u1 and o^(2p)u0
  in (9) (i.e. in effect, up to [delta]^(2p + 1)u(1/2)) is the sum of
  the first p + 1 terms of the series

        [theta](1 - [theta])   (1 + [theta])[theta](1 - [theta])(2 -[theta])
    1 + -------------------- + --------------------------------------------- +
                1.1                               (2!)^2

      (2 + [theta])(1 + [theta])[theta](1 - [theta])(2 - [theta])(3 -[theta])
      ----------------------------------------------------------------------- + ...,
                                       (3!)^2

  it being supposed in each case that [theta] lies between 0 and 1. The
  following table gives a comparison of the respective limits of error;
  the lines I. and II. give the errors due to the advancing-difference
  and the central-difference formulae, and the coefficient [rho] is
  omitted throughout.

    TABLE 4.

    +----------+------------------------------------------------+
    |          |    Error due to use of Differences up to and   |
    |          |                    including                   |
    |          +------+------+------+------+------+------+------+
    |          | 1st. | 2nd. | 3rd. | 4th. | 5th. | 6th. | 7th. |
    +----------+------+------+------+------+------+------+------+
    |.5 /  I.  | .500 | .625 | .813 |1.086 |1.497 |2.132 |3.147 |
    |   \ II.  | .500 | .625 | .625 | .696 | .696 | .745 | .745 |
    |.2 /  I.  | .500 | .580 | .724 | .960 |1.343 |1.976 |3.042 |
    |   \ II.  | .500 | .580 | .580 | .624 | .624 | .653 | .653 |
    |.4 /  I.  | .500 | .620 | .812 |1.104 |1.553 |2.265 |3.422 |
    |   \ II.  | .500 | .620 | .620 | .688 | .688 | .734 | .734 |
    |.6 /  I.  | .500 | .620 | .788 |1.024 |1.366 |1.886 |2.700 |
    |   \ II.  | .500 | .620 | .620 | .688 | .688 | .734 | .734 |
    |.8 /  I.  | .500 | .580 | .676 | .800 | .969 |1.213 |1.582 |
    |   \ II.  | .500 | .580 | .580 | .624 | .624 | .653 | .653 |
    +----------+------+------+------+------+------+------+------+

  In some cases the differences tabulated are not the tabular
  differences, but the corrected differences; i.e. each difference, like
  each value of u, is correct within [+-](1/2)[rho]. It does not follow
  that these differences should be used for interpolation. Whatever
  formula is employed, the first difference should always be the tabular
  first difference, not the corrected first difference; and, further, if
  a central-difference formula is used, each difference of odd order
  should be the tabular difference of the corrected differences of the
  next lower order. (This last result is indirectly achieved if
  Everett's formula is used.) With these precautions (i.) the
  central-difference formula is slightly improved by using corrected
  instead of tabular differences, and (ii.) the advancing-difference
  formula is greatly improved, being better than the central-difference
  formula with tabular differences, but still not so good as the latter
  with corrected differences. For [theta] = .5, for instance, supposing
  we have to go to fifth differences, the limits [+-]1.497 and [+-].696,
  as given above, become [+-].627 and [+-].575 respectively.

  9. _Completion of Table of Differences._--If no values of u outside
  the range within which we have to interpolate are given, the series of
  differences will be incomplete at both ends. It may be continued in
  each direction by treating as constant the extreme difference of the
  highest order involved; and central-difference formulae can then be
  employed uniformly throughout the whole range.

  Suppose, for instance, that the values of tan x in S 6 extended only
  from x = 60 deg. to x = 80 deg., we could then complete the table of
  differences by making the entries shown in italics below.

    _Example 7._

    +--------+---------+---------+-----------+-----------+-----------+-----------+-----------+
    |    x.  | tan x.  |[delta]u.|[delta]^2u.|[delta]^3u.|[delta]^4u.|[delta]^5u.|[delta]^6u.|
    +--------+---------+---------+-----------+-----------+-----------+-----------+-----------+
    |        |         |    +    |      +    |      +    |     +     |       +   |     +     |
    |        |         |  _6775_ |           |     _34_  |           |           |           |
    | 60 deg.| 1.73205 |         |    _425_  |           |     _9_   |           |           |
    |        |         |   7200  |           |     _43_  |           |           |           |
    | 61 deg.| 1.80405 |         |     468   |           |     _9_   |           |           |
    |        |         |   7668  |           |      52   |           |           |           |
    | 62 deg.| 1.88073 |         |     520   |           |      9    |           |           |
    |        |         |   8188  |           |      61   |           |           |           |
    | 63 deg.| 1.96261 |         |     581   |           |     10    |           |           |
    |        |         |   8769  |           |      71   |           |           |           |
    | 64 deg.| 2.05030 |    .    |     652   |      .    |      9    |           |           |
    |    .   |    .    |    .    |      .    |      .    |     .     |     .     |     .     |
    |    .   |    .    |    .    |      .    |      .    |     .     |     .     |     .     |
    |    .   |    .    |    .    |      .    |      .    |     .     |     .     |     .     |
    | 75 deg.| 3.73205 |    .    |    3409   |      .    |    187    |     .     |    18     |
    |        |         |  27873  |           |     788   |           |     73    |           |
    | 76 deg.| 4.01078 |         |    4197   |           |    260    |           |    51     |
    |        |         |  32070  |           |    1048   |           |    124    |           |
    | 77 deg.| 4.33148 |         |    5245   |           |    384    |           |    64     |
    |        |         |  37315  |           |    1432   |           |    188    |           |
    | 78 deg.| 4.70463 |         |    6677   |           |    572    |           |   _64_    |
    |        |         |  43992  |           |    2004   |           |   _252_   |           |
    | 79 deg.| 5.14455 |         |    8681   |           |   _824_   |           |   _64_    |
    |        |         |  52673  |           |   _2828_  |           |   _316_   |           |
    | 80 deg.| 5.67128 |         |  _11509_  |           |  _1140_   |           |   _64_    |
    |        |         | _64182_ |           |   _3968_  |           |   _380_   |           |
    +--------+---------+---------+-----------+-----------+-----------+-----------+-----------+

  For interpolating between x = 60 deg. and x = 61 deg. we should obtain
  the same result by applying Everett's formula to this table as by
  using the advancing-difference formula; and similarly at the other end
  for the receding differences.


  _Interpolation by Substituted Tabulation._

  10. The relation of u to x may be such that the successive differences
  of u increase rapidly, so that interpolation-formulae cannot be
  employed directly. Other methods have then to be used. The best method
  is to replace u by some expression v which is a function of u such
  that (i.) the value of v or of u can be determined for any given value
  of u or of v, and (ii.) when v is tabulated in terms of x the
  differences decrease rapidly. We can then calculate v, and thence u,
  for any intermediate value of x.

  If, for instance, we require tan x for a value of x which is nearly 90
  deg., it will be found that the table of tangents is not suitable for
  interpolation. We can, however, convert it into a table of cotangents
  to about the same number of significant figures; from this we can
  easily calculate cot x, and thence tan x.

  11. This method is specially suitable for statistical data, where the
  successive values of u represent the area of a figure of frequency up
  to successive ordinates. We have first to determine, by inspection, a
  curve which bears a general similarity to the unknown curve of
  frequency, and whose area and abscissa are so related that either can
  be readily calculated when the other is known. This may be called the
  _auxiliary curve_. Denoting by [xi] the abscissa of this curve which
  corresponds to area u, we find the value of [xi] corresponding to each
  of the given values of u. Then, tabulating [xi] in terms of x, we have
  a table in which, if the auxiliary curve has been well chosen,
  differences of [xi] after the first or second are negligible. We can
  therefore find [xi], and thence u, for any intermediate value of x.


  _Extensions._

  12. _Construction of Formulae._--Any difference of u of the rth order
  involves r + 1 consecutive values of u, and it might be expressed by
  the suffixes which indicate these values. Thus we might write the
  table of differences

    +----+----+---------+----------+--------------+-----------------+
    | x. | u. |1st Diff.| 2nd Diff.|  3rd Diff.   |    4th Diff.    |
    +----+----+---------+----------+--------------+-----------------+
    |  . |  . |    .    |     .    |       .      |        .        |
    |  . |  . |    .    |     .    |       .      |        .        |
    |  . |  . |    .    |     .    |       .      |        .        |
    |  . |  . | (-1, 0) |     .    |(-2, -1, 0, 1)|        .        |
    | x0 | u0 |         |(-1, 0, 1)|              |(-2, -1, 0, 1, 2)|
    |    |    |  (0, 1) |          | (-1, 0, 1, 2)|                 |
    | x1 | u1 |         | (0, 1, 2)|              | (-1, 0, 1, 2, 3)|
    |    |    |  (1, 2) |          |  (0, 1, 2, 3)|                 |
    | x2 | u2 |         | (1, 2, 3)|              |  (0, 1, 2, 3, 4)|
    |  . |  . |  (2, 3) |     .    |  (1, 2, 3, 4)|        .        |
    |  . |  . |    .    |     .    |       .      |        .        |
    |  . |  . |    .    |     .    |       .      |        .        |
    |  . |  . |    .    |     .    |       .      |        .        |
    +----+----+---------+----------+--------------+-----------------+

  The formulae (1) and (15) might then be written

             x - x0         x - x0   x - x1
    u = u0 + ------(0, 1) + ------ . ------(0, 1, 2) +
                h              h        2h

      x - x0   x - x1   x - x2
      ------ . ------ . ------(0, 1, 2, 3) + ...  (19),
         h       2h       3h

             x - x0         x - x0   x - x1
    u = u0 + ------(0, 1) + ------ . ------(-1, 0, 1) +
                h              h       2h

      x - x0   x - x1   x - x_(-1)
      ------ . ------ . ----------(-1, 0, 1, 2) + ...  (20).
         h       2h         3h

  The general principle on which these formulae are constructed, and
  which may be used to construct other formulae, is that (i.) we start
  with any tabulated value of u, (ii.) we pass to the successive
  differences by steps, each of which may be either downwards or
  upwards, and (iii.) the new suffix which is introduced at each step
  determines the new factor (involving x) for use in the next term. For
  any particular value of x, however, all formulae which end with the
  same difference of the _r_th order give the same result, provided
  tabular differences are used. If, for instance, we go only to first
  differences, we have

         x - x0              x - x1
    u0 + ------(0, 1) = u1 + ------(0, 1)
            h                   h

  identically.

  13. _Ordinates not Equidistant._--When the successive ordinates in the
  graph of u are not equidistant, i.e. when the differences of
  successive values of x are not equal, the above principle still
  applies, provided the differences are adjusted in a particular way.
  Let the values of x for which u is tabulated be a = x0 + [alpha]h, b =
  x0 + [beta]h, c = x0 + [gamma]h,... Then the table becomes

    +---------------+----------+---------------------------------------------------+
    |               |          |                Adjusted Differences               |
    |       x.      |    u.    +-----------------+--------------------------+------+
    |               |          |    1st Diff.    |         2nd Diff.        |  &c. |
    +---------------+----------+-----------------+--------------------------+------+
    |       .       |    .     |        .        |            .             |      |
    |       .       |    .     |        .        |            .             |      |
    |       .       |    .     |        .        |            .             |      |
    | a = x_[alpha] | u_[alpha]|                 |                          |      |
    |               |          |([alpha], [beta])|                          |      |
    | b = x_[beta]  |u_([beta])|                 |([alpha], [beta], [gamma])|      |
    |               |          |([beta], [gamma])|                          |      |
    | c = x_[gamma] | u_[gamma]|        .        |            .             |      |
    |       .       |    .     |        .        |            .             |      |
    |       .       |    .     |        .        |            .             |      |
    |       .       |    .     |        .        |            .             |      |
    +---------------+----------+-----------------+--------------------------+------+

  In this table, however, ([alpha], [beta]) does not mean u_([beta]) -
  u_([alpha]), but u_([beta]) - u_([alpha]) / ([beta] - [alpha]);
  ([alpha], [beta], [gamma]) means {([beta], [gamma]) - ([alpha],
  [beta])} / (1/2)([gamma] - [alpha]); and, generally any quantity
  ([eta], ... [phi]) in the column headed "rth diff." is obtained by
  dividing the difference of the adjoining quantities in the preceding
  column by ([phi] - [eta])/r. If the table is formed in this way, we
  may apply the principle of S 12 so as to obtain formulae such as

                    x - a                       x - a   x - b
    u = u_[alpha] + ----- . ([alpha], [beta]) + ----- . ----- . ([alpha], [beta], [gamma]) + ... (21),
                      h                           h      2h

                    x - c                       x - c   x - b
    u = u_[gamma] + ----- . ([beta], [gamma]) + ----- . ----- . ([alpha], [beta], [gamma]) + ... (22).
                      h                           h      2h

  The following example illustrates the method, h being taken to be
  1 deg.:--

    _Example 8._

    +--------+------------+-------------+-------------+-------------+
    |    x.  | u = sin x. |  1st Diff.  |  2nd Diff.  |  3rd Diff.  |
    |        |            | (adjusted). | (adjusted). | (adjusted). |
    +--------+------------+-------------+-------------+-------------+
    |        |            |      +      |      -      |      -      |
    | 20 deg.|  .3420201  |             |             |             |
    |        |            |  162932 50  |             |             |
    | 22 deg.|  .3746066  |             |   1125 00   |             |
    |        |            |  161245 00  |             |    48 75    |
    | 23 deg.|  .3907311  |             |   1222 50   |             |
    |        |            |  158800 00  |             |    48 30    |
    | 26 deg.|  .4383711  |             |   1303 00   |             |
    |        |            |  156194 00  |             |    47 49    |
    | 27 deg.|  .4539905  |             |   1445 47   |             |
    |        |            |  151857 60  |             |    46 00    |
    | 32 deg.|  .5299193  |             |   1583 48   |             |
    |        |            |  145523 67  |             |             |
    | 35 deg.|  .5735764  |             |             |             |
    +--------+------------+-------------+-------------+-------------+

  To find u for x = 31 deg., we use the values for 26 deg., 27 deg., 32
  deg. and 35 deg., and obtain

                       5                5     4
    u = .4383711 00 + ---(156194 00) + --- . ---(-1445 47) +
                       1                1     2

       5     4    -1
      --- . --- . ---(-46 00) = .5150380,
       1     2     3

  which is only wrong in the last figure.

  If the values of u occurring in (21) or (22) are u_(alpha), u_(beta),
  u_(gamma), ... u_(lambda), corresponding to values a, b, c, ... l of x,
  the formula may be more symmetrically written

        (x - b) (x - c) ... (x - l)            (x - a) (x - c) ... (x - l)
    u = ---------------------------u_[alpha] + ---------------------------u_[beta] + ...
        (a - b) (a - c) ... (a - l)            (b - a) (b - c) ... (b - l)

            (x - a) (x - b) (x - c) ...
      ... + ---------------------------u_[lambda]  (23).
            (l - a) (l - b) (l - c) ...

  This is known as _Lagrange's formula_, but it is said to be due to
  Euler. It is not convenient for practical use, since it does not show
  how many terms have to be taken in any particular case.

  14. _Interpolation from Tables of Double Entry._--When u is a function
  of x and y, and is tabulated in terms of x and of y jointly, its
  calculation for a pair of values not given in the table may be
  effected either directly or by first forming a table of values of u in
  terms of y for the particular value of x and then determining u from
  this table for the particular value of y. For direct interpolation,
  consider that [Delta] represents differencing by changing x into x +
  1, and [Delta]' differencing by changing y into y + 1. Then the
  formula is

    u_(x, y) = (l + Delta)^x (1 + [Delta]')^y u_(0, 0);

  and the right-hand side can be developed in whatever form is most
  convenient for the particular case.

  REFERENCES.--For general formulae, with particular applications, see
  the _Text-book of the Institute of Actuaries_, part ii. (1st ed. 1887,
  2nd ed. 1902), p. 434; H. L. Rice, _Theory and Practice of
  Interpolation_ (1899). Some historical references are given by C. W.
  Merrifield, "On Quadratures and Interpolation," _Brit. Assoc. Report_
  (1880), p. 321; see also _Encycl. der math. Wiss._ vol. i. pt. 2, pp.
  800-819. For J. D. Everett's formula, see _Quar. Jour. Pure and
  Applied Maths._, No. 128 (1901), and _Jour. Inst. Actuaries_, vol.
  xxxv. (1901), p. 452. As to relative accuracy of different formulae,
  see _Proc. Lon. Math. Soc._ (2) vol. iv. p. 320. Examples of
  interpolation by means of auxiliary curves will be found in _Jour.
  Royal Stat. Soc._ vol. lxiii. pp. 433, 637. See also DIFFERENCES,
  CALCULUS OF.     (W. F. Sh.)

## References

- <https://en.wikisource.org/wiki/1911_Encyclopædia_Britannica/Interpolation>
- <https://archive.org/details/encyclopaediabri>
- <https://commons.wikimedia.org/>
- <https://www.britannica.com/>

#engineering #history
